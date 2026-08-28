/*
  # Coupon promotion scheduling

  Turns the coupon list into a queue. A code you intend to announce publicly
  gets a date you plan to post it on, a message to post, a reminder email the
  day before, and a one-click post to the Facebook Page.

  1. New columns on `coupons`
    - `promote` (boolean) — the flag that puts a code in the promotion queue.
      Off by default, because a code handed to one customer is not a campaign
      and has no business appearing in the queue or triggering an email.
    - `promo_post_at` (timestamptz) — when you plan to post it. This is the
      order the admin list is sorted by, so the next code up is the top card.
      Deliberately separate from `starts_at`: announcing a code the evening
      before it opens is normal, and the reminder needs a time of day where
      `starts_at` only has a date.
    - `promo_message` (text) — what actually gets posted. Drafted by Claude,
      editable by hand, and quoted in the reminder email so the email is
      enough to post from on a phone.
    - `promo_reminder_sent_at` (timestamptz) — when the reminder went out.
    - `promo_reminder_for` (timestamptz) — the `promo_post_at` the reminder
      covered. Re-arming keys off this rather than a boolean, so moving the
      date sends a fresh reminder while editing the message does not. Same
      shape as `jobs.schedule_notified_for`.
    - `facebook_post_id`, `facebook_posted_at`, `facebook_post_error` — the
      result of the last post attempt, mirroring `gallery_items`.

  2. Scheduling
     A cron job runs hourly and calls `send-coupon-promo-reminders`, which
     finds codes due inside the lead window and emails one reminder each.
     Hourly is precise enough for a reminder a day out — it lands between 23
     and 24 hours ahead — and keeps the inbox quiet.

  3. Security
     No RLS changes. The new columns sit on a table `anon` is already revoked
     from, and `lookup_coupon_by_code()` names its columns explicitly, so none
     of this reaches the public lookup. A scheduled promotion stays invisible
     to customers until the code itself goes live.
*/

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS promote boolean NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS promo_post_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS promo_message text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS promo_reminder_sent_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS promo_reminder_for timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS facebook_post_id text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS facebook_posted_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS facebook_post_error text;

COMMENT ON COLUMN public.coupons.promote IS
  'In the promotion queue: gets a post date, a reminder email and a Post to Facebook button.';
COMMENT ON COLUMN public.coupons.promo_post_at IS
  'When this code is due to be announced. The admin list sorts the queue by this, soonest first.';
COMMENT ON COLUMN public.coupons.promo_reminder_for IS
  'promo_post_at value the last reminder covered; NULL means never reminded. Moving the date re-arms the reminder.';

-- The reminder job and the admin queue both ask the same question: which
-- promoted codes have not been posted yet, soonest first.
CREATE INDEX IF NOT EXISTS idx_coupons_promo_queue
  ON public.coupons (promo_post_at)
  WHERE promote AND facebook_posted_at IS NULL;

-- ── Hourly reminder job ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-coupon-promo-reminders') THEN
    PERFORM cron.unschedule('send-coupon-promo-reminders');
  END IF;
END $$;

/*
  Minute 5 rather than 0 so this does not land on the same tick as every other
  hourly job.

  The call authenticates with the service role key read from Vault, not with
  the anon key: `send-coupon-promo-reminders` sends mail, so it requires the
  service role or a signed-in admin, and the anon key is neither. Nothing
  secret is committed here — the key is stored once, by hand, and this reads
  it by name:

      SELECT vault.create_secret('<service role key>', 'service_role_key');

  Selecting FROM the vault view rather than sub-querying into the header means
  a missing secret sends nothing at all, instead of posting a NULL
  Authorization header and collecting 401s every hour.
*/
SELECT cron.schedule(
  'send-coupon-promo-reminders',
  '5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-coupon-promo-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.decrypted_secret
    ),
    body := jsonb_build_object('trigger', 'cron')
  )
  FROM vault.decrypted_secrets s
  WHERE s.name = 'service_role_key';
  $cron$
);
