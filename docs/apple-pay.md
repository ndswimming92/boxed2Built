# Apple Pay

Customers can pay a Boxed2Built invoice with Apple Pay (and Google Pay) in two places:

| Surface | How it works | Needs setup? |
|---|---|---|
| Stripe-hosted Checkout | The existing **Pay Now** button redirects to `checkout.stripe.com`, which offers Apple Pay automatically. | Apple Pay enabled on the Stripe account |
| The pay page itself | `ExpressCheckoutElement` renders a native Apple Pay button inline on `/pay/:invoiceId/:paymentToken`, so the customer never leaves the site. | Apple Pay enabled **and** the domain registered |

`payment_method_types: ['card']` on a Checkout Session does **not** suppress wallets — the `card`
type implicitly enables Apple Pay and Google Pay. Hosted Checkout therefore needed no code change.

## One-time setup

### 1. Enable Apple Pay on the Stripe account

Stripe Dashboard → **Settings → Payments → Payment methods** → enable Apple Pay.

Do this in **both live and test mode**. This codebase picks its Stripe mode at runtime from
`stripe_settings.stripe_mode`, toggled by an admin at `/admin/payment-methods`, so a payment
method enabled in only one mode will silently vanish when the toggle flips.

### 2. Register the domains

Only needed for the inline button; hosted Checkout works without it.

Stripe Dashboard → **Settings → Payment method domains** → add **both**:

- `boxed2built.com`
- `www.boxed2built.com`

Apple verifies the apex and `www` separately; registering one does not cover the other.

Download the association file Stripe gives you and commit it to:

```
public/.well-known/apple-developer-merchantid-domain-association
```

No file extension. `netlify.toml` already pins its content type and the SPA fallback in
`public/_redirects` is scoped to named route families, so the path is served as a real file.
Confirm after deploying:

```
curl -sI https://www.boxed2built.com/.well-known/apple-developer-merchantid-domain-association
```

Expect `200` and `content-type: text/plain`. A `404`, or HTML in the body, means the file did not
ship and Apple Pay will not render.

### 3. Publishable keys

`create-payment-intent` returns the publishable key to the browser alongside the client secret,
so the two can never disagree about mode. Set both as Supabase edge function secrets:

- `Stripe_Live_Publishable_Key`
- `Stripe_Sandbox_Publishable_Key`

These sit beside the existing `Stripe_Live_Secret_Key` / `Stripe_Sandbox_Secret_Key`. Publishable
keys are safe to expose to the browser; the secret keys must never be.

If the key for the active mode is missing, `create-payment-intent` returns a 500 and the pay page
quietly falls back to the **Pay Now** redirect. Nothing breaks; the wallet button just never shows.

## How a payment settles

The inline button charges a **PaymentIntent** directly — there is no Checkout Session behind it.
Three things cooperate so an invoice cannot be missed or double-credited:

1. `stripe-webhook` → `handleInvoicePaymentEvent` dispatches on `metadata.invoice_id` and writes
   the `invoice_payments` row in real time. It runs **before** the generic subscription branches,
   which drop bare `payment_intent.*` events.
2. The `invoice_payments` insert trigger recomputes `amount_paid` / `amount_due` and moves the
   invoice to `paid` or `partially_paid`. Status is never set by hand.
3. `reconcile-stripe-payments` has a second pass over invoices that have a
   `stripe_payment_intent_id` but no `stripe_session_id`, as a backstop for a missed webhook.

Both writers key idempotency on `payment_reference = <payment intent id>`, so a webhook replay and
a reconciler run cannot credit the same intent twice.

## Deploying

Per `.github/workflows/deploy-functions.yml`, the Supabase GitHub integration only ships **new**
edge functions — **changed** ones are silently not redeployed. `create-payment-intent` is new, but
`stripe-webhook` and `reconcile-stripe-payments` are changed and must be deployed deliberately.

## Testing

Flip `stripe_settings.stripe_mode` to `test` at `/admin/payment-methods`, then open a test
invoice's pay link on a real iPhone. The Simulator has no wallet, and neither does a desktop
browser without a card in it, so the button will not appear there — that is expected, not a bug.

Verify after paying:

- invoice status becomes `paid`
- exactly one `invoice_payments` row exists with `source = 'stripe_express'`
- a `payment_webhook_events` row exists with `processing_status = 'processed'`
- replaying the webhook from the Stripe dashboard creates no second payment row

## What is deliberately not here

- **Tap to Pay on iPhone** (customer taps their phone against yours) needs a native iOS app with
  Apple's ProximityReader entitlement. Use the **Stripe Dashboard iOS app** instead — it already
  holds the entitlement and needs no code.
- **Money does not land in an Apple Wallet.** Payments settle to the Stripe balance and then to
  the payout bank account. Apple Cash is the only thing that pays into a Wallet and its terms
  forbid business use.
