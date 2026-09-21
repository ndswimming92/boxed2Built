# Coupon Codes

Discount codes you create in the admin portal and customers enter on the quote
form. A code takes a percentage or a flat dollar amount off, and that discount
follows the lead all the way to the invoice.

Admin page: **Financial Management → Coupons** (`/admin/coupons`).

## Creating a code

**New Coupon** asks for the code itself, what it takes off, and when it runs:

| Field | Meaning |
| --- | --- |
| Code | What the customer types, e.g. `WELCOME25`. 3–30 characters, letters, numbers and dashes. Stored uppercase, so how it is typed never matters. |
| Description | For you, not the customer — it shows on the admin card only. |
| Discount | `$ off` for a flat amount, `% off` for a percentage (capped at 100). |
| First day / Last day | Optional. The code works from the start of the first day through the end of the last day, in your timezone. Leave either empty for open-ended. |
| Accept this code on the form | The on/off switch, independent of the dates. |
| Promote this code | Puts it in the posting queue below. Off by default — a code handed to one customer is not a campaign. |
| Post on | Only when Promote is ticked. When you mean to announce it. Defaults to 9am on the first day. |
| The post | Only when Promote is ticked. What goes on Facebook. Leave it empty and Claude writes it. |

Each card shows one of four states:

- **Active** — on, and inside its dates. The form accepts it.
- **Scheduled** — on, but its first day has not arrived.
- **Expired** — its last day has passed.
- **Off** — switched off by hand.

Only **Active** codes work. To a customer, the other three are indistinguishable
from a code that does not exist — the lookup answers only for live codes, so
nobody can use the form to discover next month's promotion.

## Sharing a code

Three buttons on every card:

- **Copy** — the code on its own, for a text or a caption.
- **Link** — a link to your quote form with the code already filled in and
  applied (`/contact?coupon=WELCOME25`).
- **Share** — the phone's share sheet with a ready-made message, or the same
  message copied to the clipboard on desktop.

## Who used a code

Every card carries a usage count — *Used 4 times · last Sep 11* — and under it,
the people behind that number: each customer's name, their email address as a
link that opens a reply, the day they used it, and what the code took off their
quote.

Three names show at a time. **Show all 4** opens the rest, **Show fewer** folds
it back.

The names come from the quote requests the code was entered on, so a request
you have deleted takes its name with it. When the count is higher than the list,
the card says so — *2 earlier uses have no request on file* — rather than
quietly showing a shorter list than the number above it. Renaming a code does
the same thing: its earlier uses stay filed under the old spelling, so the
count survives the rename but the names do not follow it.

A submission from one of your registered test identities is counted by the
coupon like any other, so it is tagged `TEST` in the list rather than hidden —
the same badge the inquiry itself carries. Hiding it would leave the list one
name short of the count with nothing to explain the gap.

## The posting queue

Ticking **Promote this code** puts it in a queue, and the page is sorted by that
queue: the code due to be posted soonest is the top card, and the one at the very
top gets its own **Next up to post** panel with the message, the discount, how
long it runs, and the button to post it. Nothing has to be worked out by hand —
whatever is at the top is what goes out next.

Below the queue the page falls back to newest-first, which is where unpromoted
codes and already-posted promotions live.

### The reminder email

Twenty-four hours before a promotion is due, an email arrives with everything
needed to post it from a phone:

- the code and what it is for, as the subject and heading
- the discount — `$25 off`, `15% off`
- how long it will be active — *Monday, September 1 through Tuesday, September
  30 (30 days)*
- the message itself, ready to copy
- a button back to this page to post it in one click

One reminder per code. Move the post date and a fresh one goes out; editing the
message does not re-send. **Email me** on a queued card sends that coupon's
reminder immediately, which is how to check the email lands before it matters.

If the code is switched off when the reminder goes out, the email says so —
posting a code the form will refuse just sends people to a dead end.

### Writing the post

**Draft with Claude** writes the Facebook post from the code, the discount, the
dates and the description, in the business's voice: four to six short lines, the
code on its own line, the real deadline, the prefilled quote link, and
`#Boxed2Built`. Edit it afterwards however you like — the box is the source of
truth from then on.

You never have to press it. A promotion with no message written gets one drafted
automatically when its reminder goes out, and if Claude is unreachable a plain
built-in version is used instead, so the email always carries something postable.

### Posting

**Post to Facebook** puts the message on the Page, from the banner or from the
card. What is in the message box is what goes out, including an unsaved edit.

Facebook only. Instagram's API requires an image on every post — there is no
text-only path — so a coupon announcement cannot go there the way a gallery
photo does. Posting is manual by design: the reminder nudges, you decide.

A code that is switched off or already expired is refused before it reaches
Facebook, and a rejection from Facebook is kept on the card so it is visible
rather than silent.

## What the customer sees

The quote form's **Have a Referral or Coupon Code?** box takes both kinds of
code. When they leave the box, the code is checked:

- A live coupon shows `WELCOME25 applied — $25 off`, and the estimate updates
  to show the old price struck through beside the new one.
- Anything else shows "Not a coupon code — we'll treat it as a referral code",
  and the referral behaviour is unchanged: a friend's code still credits them.

The discounted number is the one that gets submitted, so it is what appears on
the confirmation screen, in the confirmation email, on the request-lookup page,
and on the inquiry in your admin portal. Both emails also name the coupon.

## What you see

The inquiry carries an amber coupon badge, and its estimated price is the
discounted one, marked *after coupon*. Converting it to a job carries the
discounted quote across and notes the coupon in the job description.

Raising an invoice from that inquiry — or from the job it became — adds the
discount line for you:

```
Coupon WELCOME25 ($25 off)   1 × -$25.00
```

A percentage coupon prices itself off whatever the other line items total, and
keeps up as you edit them. The line is an ordinary discount line after that:
edit or delete it like any other. Only new invoices get one, so re-opening an
invoice never double-discounts it.

## Turning one off, and deleting

**Off** stops the form accepting the code while keeping it and its history.
**Delete** removes it for good. Neither touches quotes already given: the
discount is snapshotted onto the inquiry when the customer submits, so an
invoice raised months later still carries the discount they were promised.

## Under the hood

- `coupons` holds the codes; `form_inquiries.coupon_code`,
  `coupon_discount_type`, `coupon_discount_value` and `coupon_discount_amount`
  hold the snapshot. See `supabase/migrations/20260828150000_create_coupon_codes.sql`.
- The public path is `lookup_coupon_by_code()`, a `SECURITY DEFINER` function
  granted to `anon` that returns live coupons only and is throttled at 20
  lookups per IP per 15 minutes. `anon` has no rights on the table itself.
- The usage counter is maintained by a definer-rights trigger on inquiry
  insert, because the customer submitting the form cannot write to `coupons`.
  That trigger function is not callable over the API — `EXECUTE` is revoked
  from `anon` and `authenticated`, which does not affect the trigger itself.
- The names under that counter are read by `getCouponRedemptions()`, one query
  across `form_inquiries` for the whole page rather than one per card, grouped
  by `coupon_code`. `coupons` stores no customer, so there is nothing to
  migrate and nothing duplicated: the inquiry stays the only record of who
  entered a code. A failure there dims that one panel rather than the page.
- Discount arithmetic lives in `src/utils/coupon.ts` so the form, the admin
  page and the invoice line all round the same way. A coupon never exceeds the
  amount it is discounting.
- The promotion columns (`promote`, `promo_post_at`, `promo_message`, the
  reminder markers and the Facebook post result) are added by
  `supabase/migrations/20260828170000_add_coupon_promotion_scheduling.sql`.
  None of them reach `lookup_coupon_by_code()`, so a scheduled promotion stays
  invisible to customers until the code itself goes live.
- The queue order lives in `sortCouponsForQueue()` in `src/utils/coupon.ts` and
  is applied in `getCoupons()`, so the page and its tests cannot disagree about
  what "next up" means.
- Three edge functions back the buttons: `draft-coupon-promo` (Claude),
  `publish-coupon-promo` (the Page post) and `send-coupon-promo-reminders` (the
  email). All three are admin-or-service only. The reminder job also runs on an
  hourly `pg_cron` tick; the lead time is `COUPON_PROMO_REMINDER_LEAD_HOURS`
  (24 by default) and the recipient is `COUPON_PROMO_NOTIFY_EMAIL`, falling
  back to the business contact address.
- That cron job authenticates with the service role key read from Vault under
  the name `service_role_key`. Store it once with
  `SELECT vault.create_secret('<service role key>', 'service_role_key');` — with
  no such secret the job posts nothing rather than failing hourly.
- `tests/coupons.spec.ts` covers the customer-facing pricing, the admin list and
  the posting queue; `supabase/tests/coupon_test_cases.sql` covers the database
  rules.
