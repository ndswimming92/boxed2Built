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

## In person: Tap to Pay at the job site

Tap to Pay on iPhone — the customer holding their phone against yours — needs a native iOS app
carrying Apple's ProximityReader entitlement. Safari has no API for it, so no amount of work on
this site can provide it.

**Use the Stripe Dashboard iOS app.** It already holds the entitlement, works with the existing
Stripe account, and needs no code. Requires an iPhone XS or newer; it accepts Apple Pay, Google
Pay and contactless cards. Stripe charges the usual rate plus 10¢ per tap.

### Linking the tap back to the invoice

A charge taken in the Dashboard app carries no invoice metadata, so nothing connects it to this
system on its own: the invoice would sit at `sent` and `clients.total_revenue` would never move.

Field flow:

1. Finish the job.
2. Open the Stripe app, enter the amount, let the customer tap.
3. In admin, open the invoice → **Record Payment** → **Link a Stripe payment** → **Find payments**.
4. Press **Link** on the matching charge.

`list-unlinked-stripe-payments` lists succeeded PaymentIntents from the last 30 days that have no
`invoice_payments` row, labelled by how they were taken ("Tap to Pay · VISA ····4242"). It is
read-only and staff-only via `authorizeAdminOrService`; the write happens client-side through
`linkStripePaymentToInvoice`.

The amount comes from Stripe, never from anything typed in, so an invoice can only be credited
what was actually charged. The row is tagged `source = 'stripe_terminal'` and
`payment_method = 'tap_to_pay'`, and the usual `invoice_payments` trigger closes the invoice out.

### Why a partial unique index

Migration `20260922120000_guard_stripe_payment_reference_uniqueness.sql` adds a unique index on
`payment_reference` covering only `pi_%` and `cs_%`.

Three writers can now record a Stripe payment — the webhook, the reconciler, and this link action
— and each does a check-then-insert, which is not atomic. Two racing on the same intent would both
see nothing and both insert. The index is what actually prevents the double credit.

It is partial because `payment_reference` also holds hand-typed check numbers and Venmo notes,
which legitimately repeat across customers; a blanket unique index would reject the second
customer's check #1234. Stripe object ids are globally unique, so only they are constrained.

## What is deliberately not here

**Money does not land in an Apple Wallet.** Payments settle to the Stripe balance and then to the
payout bank account — set that to the Found business checking account and everything this site
collects lands there. Apple Cash is the only thing that pays into a Wallet, and its terms forbid
business use.

**Found cannot replace Stripe.** Found partners with Stripe for card acceptance, lists no Apple
Pay among the methods a client can use to pay a Found invoice, and exposes no developer API, so
its invoicing cannot be driven from this site.
