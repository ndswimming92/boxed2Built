# Coupon Codes

Discount codes you create in the admin portal and customers enter on the quote
form. A code takes a percentage or a flat dollar amount off, and that discount
follows the lead all the way to the invoice.

Admin page: **Financial Management → Coupons** (`/admin/coupons`).

## Creating a code

**New Coupon** asks for five things:

| Field | Meaning |
| --- | --- |
| Code | What the customer types, e.g. `WELCOME25`. 3–30 characters, letters, numbers and dashes. Stored uppercase, so how it is typed never matters. |
| Description | For you, not the customer — it shows on the admin card only. |
| Discount | `$ off` for a flat amount, `% off` for a percentage (capped at 100). |
| First day / Last day | Optional. The code works from the start of the first day through the end of the last day, in your timezone. Leave either empty for open-ended. |
| Accept this code on the form | The on/off switch, independent of the dates. |

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
- Discount arithmetic lives in `src/utils/coupon.ts` so the form, the admin
  page and the invoice line all round the same way. A coupon never exceeds the
  amount it is discounting.
- `tests/coupons.spec.ts` covers the customer-facing pricing and the admin
  list; `supabase/tests/coupon_test_cases.sql` covers the database rules.
