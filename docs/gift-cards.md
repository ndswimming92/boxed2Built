# Gift Card System

End-to-end overview of the Boxed2Built gift card system, its data model, edge functions, and operational notes.

The system is designed to reuse the existing Stripe credentials and webhook endpoint that already power the site's other payment flows — no additional Stripe products, prices, webhook endpoints, or environment variables are required to turn it on.

## Flow summary

1. Customer visits `/gift-cards`, picks a preset denomination ($25 / $50 / $100 / $200) or enters a custom whole-dollar amount ($10–$1,000), chooses self- or recipient-delivery, and clicks **Continue to Checkout**.
2. The `create-gift-card-checkout` edge function reserves a pending row in `gift_cards`, generates a unique `B2B-XXXX-XXXX` code, and creates a Stripe Checkout Session with `metadata.kind = 'gift_card'` and inline `price_data` (no pre-registered Stripe Price IDs required).
3. Stripe delivers events to the existing `stripe-webhook` endpoint. The handler inspects `metadata.kind` and dispatches gift card events to a dedicated branch that flips the card to `active`, stores `stripe_payment_intent_id`, and invokes `send-gift-card-email`.
4. The customer lands on `/gift-cards/success?session_id=...`, which polls `get-gift-card-confirmation` until the webhook has activated the card (then displays the code for self-delivery, or "sent to recipient" messaging).
5. Recipients redeem via `/redeem-gift-card` (balance check) and then continue to `/contact` with the code prefilled. Admins apply credit manually against a job or invoice from the admin UI.
6. Credits are stored in `gift_card_redemptions` and decrement `gift_cards.remaining_amount_cents`. Balances roll over; there is no expiration.

## Data model

### Tables

- **`gift_cards`** — one row per purchase. Unique `code`, unique `stripe_checkout_session_id`. Status lifecycle: `pending -> active -> partially_redeemed -> redeemed`, plus `voided` and `failed`. Amounts constrained to the preset denominations ($25/$50/$100/$200) or a whole-dollar custom amount from $10 to $1,000 (in cents).
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
| `create-gift-card-checkout` | Public | Validates payload, inserts pending `gift_cards` row, creates a Stripe Checkout Session with inline `price_data`, returns `{ url, gift_card_id }`. |
| `stripe-webhook` | Public (signed by Stripe) | Unified webhook. Dispatches events with `metadata.kind === 'gift_card'` to the gift card handler (activate, fail, or skip). Uses the existing `STRIPE_WEBHOOK_SECRET`. |
| `send-gift-card-email` | Public | Sends two Resend templates (recipient-facing or purchaser-facing). Safe to re-invoke for "resend email" admin action. |
| `redeem-gift-card` | `verify_jwt: true` | Admin-only wrapper around `redeem_gift_card()`. Pulls user info from the JWT so admin redemptions are attributed. |
| `get-gift-card-confirmation` | Public | Used by `/gift-cards/success` to poll for webhook completion. Exposes `code` only to the purchaser flow (self-delivery). |
| `gift-card-webhook` | Deprecated | Returns HTTP 410 pointing callers at the unified `stripe-webhook`. Left as a stub for safety. |

## Stripe setup

No new setup required. The system reuses the existing Stripe configuration:

- **Secret key**: existing `STRIPE_SECRET_KEY`.
- **Webhook endpoint**: existing endpoint pointed at `/functions/v1/stripe-webhook`.
- **Webhook signing secret**: existing `STRIPE_WEBHOOK_SECRET`.
- **Products / Prices**: none needed. Each gift card is sold with inline `price_data` generated per-session.

Stripe must be subscribed to `checkout.session.completed` on that endpoint (which it already is for subscription/one-time order handling). `checkout.session.expired` and `payment_intent.payment_failed` are optional — add them to the existing endpoint if you want abandoned carts to be flipped to `failed` automatically; otherwise pending rows simply sit unused.

## Resend setup

Reuses the existing Resend API key and the shared `team@boxed2built.com` verified sender — identical to `send-invoice-email`, `send-followup-email`, etc. Sends are logged to the `email_events` table.

## Environment variables

Every required secret already exists in the Supabase project:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

App URLs and sender identity are hardcoded to match the rest of the codebase (`https://www.boxed2built.com`, `team@boxed2built.com`).

## Admin UI

`/admin/gift-cards` (platform admins only):

- Searchable / status-filtered table of all cards with totals (sold, outstanding, redeemed).
- Detail view with redemption history, "Apply credit" form (amount + optional job/invoice + notes), "Resend email", and "Void card".
- All mutations funnel through `redeem_gift_card()` / authenticated RLS to keep the audit trail consistent.

## Testing checklist

1. Buy a $25 self-delivery card with a Stripe test card (`4242 4242 4242 4242`). Confirm:
   - Pending row appears immediately in `gift_cards`.
   - The existing `stripe-webhook` flips the card to `active` within a few seconds.
   - `/gift-cards/success` shows the code and copy button.
   - Send is logged in `email_events`.
2. Buy a $50 recipient-delivery card. Confirm the recipient receives the branded email and the success page shows "sent to…" instead of the code.
3. Visit `/redeem-gift-card`, paste the code, confirm balance, click "Continue to quote", and verify the contact form prefills the code field.
4. In the admin UI, apply $10 credit against the card. Confirm the remaining balance drops to $15, status becomes `partially_redeemed`, and a ledger row is attributed to your admin user.
5. Apply another $15. Status should become `redeemed` and remaining balance hits $0.
6. Attempt to apply credit on a redeemed card — the RPC should reject it.
7. Void an unrelated active card and confirm subsequent redemption attempts fail.

## Operational notes

- Partial balances roll over and never expire by design. This is advertised in all customer-facing UI and emails.
- Voiding does **not** refund Stripe. For refunds, issue the refund in Stripe first (which also marks the payment intent as refunded), then void the card in the admin UI.
- The `create-gift-card-checkout` function rolls back the pending row if Stripe session creation fails, so abandoned carts don't leave orphan codes.
- Code collisions are vanishingly rare (roughly 32^8 possibilities) but the insert is retried up to 5 times just in case.
