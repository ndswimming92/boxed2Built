# Gift Card System

End-to-end overview of the Boxed2Built gift card system, its data model, edge functions, and the operational steps required to turn it on in production.

## Flow summary

1. Customer visits `/gift-cards`, picks a fixed denomination ($25 / $50 / $100 / $200), chooses self- or recipient-delivery, and clicks **Continue to Checkout**.
2. The `create-gift-card-checkout` edge function reserves a pending row in `gift_cards`, generates a unique `B2B-XXXX-XXXX` code, and creates a Stripe Checkout Session with `metadata.kind = 'gift_card'`.
3. On successful payment, Stripe calls the `gift-card-webhook` endpoint. The webhook flips the card to `active`, stores `stripe_payment_intent_id`, and invokes `send-gift-card-email`.
4. The customer lands on `/gift-cards/success?session_id=...`, which polls `get-gift-card-confirmation` until the webhook has activated the card (then displays the code for self-delivery, or "sent to recipient" messaging).
5. Recipients redeem via `/redeem-gift-card` (balance check) and then continue to `/contact` with the code prefilled. Admins apply credit manually against a job or invoice from the admin UI.
6. Credits are stored in `gift_card_redemptions` and decrement `gift_cards.remaining_amount_cents`. Balances roll over; there is no expiration.

## Data model

### Tables

- **`gift_cards`** — one row per purchase. Unique `code`, unique `stripe_checkout_session_id`. Status lifecycle: `pending -> active -> partially_redeemed -> redeemed`, plus `voided` and `failed`. Amounts constrained to $25/$50/$100/$200 (in cents).
- **`gift_card_redemptions`** — append-only ledger. FK to `gift_cards`. Optional FK-like fields for `job_id` / `invoice_id`.
- **`form_inquiries.gift_card_code`** — nullable column so inbound leads can reference a code they plan to redeem.

### Postgres functions

- `lookup_gift_card_by_code(p_code text)` — `SECURITY DEFINER`, returns a safe public subset (code, status, amounts, recipient first name only, delivery type, activated_at). Granted to `anon` and `authenticated`.
- `redeem_gift_card(...)` — `SECURITY DEFINER`. Uses `SELECT ... FOR UPDATE` to prevent double-spend. Validates status and amount. Inserts redemption; flips status to `redeemed` when balance hits 0. Granted to `authenticated` only.

### RLS

RLS is enabled on both tables. Only `is_platform_admin()` admins can `SELECT/INSERT/UPDATE/DELETE`. The customer-facing flow uses the two `SECURITY DEFINER` functions exclusively.

## Edge functions

| Function | Auth | Purpose |
| --- | --- | --- |
| `create-gift-card-checkout` | Public | Validates payload, inserts pending `gift_cards` row, creates a Stripe Checkout Session, returns `{ url, gift_card_id }`. |
| `gift-card-webhook` | Public (signed by Stripe) | Handles `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`. Only acts on events where `metadata.kind === 'gift_card'`. Idempotent (skips events already reflected in DB). |
| `send-gift-card-email` | Public | Sends two Resend templates (recipient-facing or purchaser-facing). Safe to re-invoke for "resend email" admin action. |
| `redeem-gift-card` | `verify_jwt: true` | Admin-only wrapper around `redeem_gift_card()`. Pulls user info from the JWT so admin redemptions are attributed. |
| `get-gift-card-confirmation` | Public | Used by `/gift-cards/success` to poll for webhook completion. Exposes `code` only to the purchaser flow (self-delivery). |

## Stripe setup (one-time)

1. Create four **Products + Prices** in the Stripe dashboard, one per denomination. Use one-time (not recurring) prices for $25.00, $50.00, $100.00, and $200.00.
2. Copy the Price IDs and set these Supabase Edge Function secrets:
   - `STRIPE_GIFT_CARD_PRICE_25`
   - `STRIPE_GIFT_CARD_PRICE_50`
   - `STRIPE_GIFT_CARD_PRICE_100`
   - `STRIPE_GIFT_CARD_PRICE_200`
3. Register a **webhook endpoint** in Stripe pointing at:
   `https://<project-ref>.supabase.co/functions/v1/gift-card-webhook`
   Subscribe to `checkout.session.completed`, `checkout.session.expired`, and `payment_intent.payment_failed`.
4. Store the webhook signing secret as `STRIPE_GIFT_CARD_WEBHOOK_SECRET` (falls back to `STRIPE_WEBHOOK_SECRET` if not set).

## Resend setup

The email sender reuses the verified `GIFT_CARD_FROM_EMAIL` (default `team@boxed2built.com`). Make sure the sender domain is verified in Resend. The function logs sends to the `email_events` table for observability.

## Environment variables

Edge Function secrets (configure in Supabase, not `.env`):

- `STRIPE_SECRET_KEY`
- `STRIPE_GIFT_CARD_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET`)
- `STRIPE_GIFT_CARD_PRICE_25`, `STRIPE_GIFT_CARD_PRICE_50`, `STRIPE_GIFT_CARD_PRICE_100`, `STRIPE_GIFT_CARD_PRICE_200`
- `RESEND_API_KEY`
- `GIFT_CARD_FROM_EMAIL` (optional override)
- `APP_URL` (used in email links; defaults to `https://www.boxed2built.com`)

Automatically provided by Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Admin UI

`/admin/gift-cards` (platform admins only):

- Searchable / status-filtered table of all cards with totals (sold, outstanding, redeemed).
- Detail view with redemption history, "Apply credit" form (amount + optional job/invoice + notes), "Resend email", and "Void card".
- All mutations funnel through `redeem_gift_card()` / authenticated RLS to keep the audit trail consistent.

## Testing checklist

1. Buy a $25 self-delivery card with a Stripe test card (`4242 4242 4242 4242`). Confirm:
   - Pending row appears immediately in `gift_cards`.
   - Webhook flips status to `active` within a few seconds.
   - `/gift-cards/success` shows the code and copy button.
   - Resend email is logged in `email_events`.
2. Buy a $50 recipient-delivery card. Confirm the recipient receives the branded email and the success page shows "sent to…" instead of the code.
3. Visit `/redeem-gift-card`, paste the code, confirm balance, click "Continue to quote", and verify the contact form prefills the code field.
4. In the admin UI, apply $10 credit against the card. Confirm:
   - Remaining balance drops to $15 and status becomes `partially_redeemed`.
   - Redemption ledger row appears with your admin name attached.
5. Apply another $15. Status should become `redeemed` and remaining balance hits $0.
6. Attempt to apply credit on a redeemed card — the RPC should reject it.
7. Void an unrelated active card and confirm subsequent redemption attempts fail.

## Operational notes

- Partial balances roll over and never expire by design. This is advertised in all customer-facing UI and emails.
- Voiding does **not** refund Stripe. For refunds, issue the refund in Stripe first (which also marks the payment intent as refunded), then void the card in the admin UI.
- The `create-gift-card-checkout` function rolls back the pending row if the Stripe session creation fails, so abandoned carts don't leave orphan codes.
- Code collisions are vanishingly rare (roughly 32^8 possibilities) but the insert is retried up to 5 times just in case.
