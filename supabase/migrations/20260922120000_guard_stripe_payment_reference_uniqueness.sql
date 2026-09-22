/*
  # Stop a Stripe payment being credited twice

  ## Overview
  Three separate writers can now record a Stripe payment against an invoice:

    - `stripe-webhook` settles Express Checkout (Apple Pay / Google Pay) in real
      time from `payment_intent.succeeded`,
    - `reconcile-stripe-payments` sweeps up anything the webhook missed,
    - the admin "Link a Stripe payment" action attaches an in-person Tap to Pay
      charge taken in the Stripe Dashboard app, which has no invoice metadata.

  Each checks for an existing row before inserting, but a check-then-insert is
  not atomic: two of them racing on the same intent both see nothing and both
  insert, and the `invoice_payments` trigger then credits the invoice twice.
  This adds the database-level guarantee that makes those checks safe.

  ## 1. Changes to existing tables
    - `invoice_payments` — new partial unique index on `payment_reference`.

  ## 2. Why the index is partial
  `payment_reference` is also where staff type a check number or a Venmo note,
  and those legitimately repeat across customers — two clients can both pay with
  their own check #1234. A blanket unique index would reject the second one.

  Stripe object ids are globally unique, so the index covers only those:
  `pi_` (PaymentIntent) and `cs_` (Checkout Session). Manual references are
  untouched, and NULL references are excluded by the partial predicate.

  ## 3. Notes
  Every existing `invoice_payments.payment_reference` is NULL, so this applies
  to current data without conflict.
*/

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_stripe_reference_key
  ON public.invoice_payments (payment_reference)
  WHERE payment_reference LIKE 'pi_%' OR payment_reference LIKE 'cs_%';

COMMENT ON INDEX public.invoice_payments_stripe_reference_key IS
  'One invoice_payments row per Stripe PaymentIntent or Checkout Session. Deliberately partial: manual references such as check numbers repeat legitimately across customers.';
