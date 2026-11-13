# The Inquiries working list

How the **Form Inquiries** page decides what to show you, and how an inquiry
leaves it once you are finished with it.

## An inquiry is wrapped up when two things are true

The page is a working list, not an archive. An inquiry stays on it until both
halves of "done" have happened:

1. **It became a job** — status `converted_to_job`, either by creating the job
   from the inquiry or by marking it converted because the job already existed.
2. **The customer heard back** — any recorded contact: the **Reached out**
   button on the card, **I Reached Out** in the detail view, or an invoice sent
   from the inquiry, which logs a communication of its own.

With both true the inquiry is *wrapped up* and drops out of the default view on
its own. One without the other keeps it on the list, and that is the point: a
booked job nobody has replied to is exactly the thing you do not want to lose
track of.

## What the Status filter shows

| Filter | Shows |
| --- | --- |
| **Needs Attention** (default) | Everything not wrapped up and not archived |
| All Statuses | Every inquiry on file |
| Pending | Not yet converted to a job |
| Converted | Converted, whether or not you have reached out |
| Wrapped Up | Converted *and* contacted — the ones the default view hides |
| Archived | Dismissed by hand |

Nothing is deleted or archived behind your back. A wrapped-up inquiry keeps its
`converted_to_job` status, so it still counts toward the **Converted** tile and
the conversion rate, and a note under the list says how many are hidden with a
**Show them** button beside it.

The filter is not sticky: every visit opens on **Needs Attention**, so switching
to All Statuses to look something up never leaves the page cluttered tomorrow.

## Clearing one by hand

A converted inquiry you have not logged contact for carries an amber
**Booked — reach out to wrap this up** badge. Its card has a **Reached out**
button: one click records the contact and the inquiry leaves the list.

On an inquiry that has not converted, the same button records your response time
and nothing else — the lead is still live, so it stays where you can see it.

Leads that go nowhere are still dismissed with **Archive**, which is separate
from all of this and hides an inquiry whatever its status.

## Why it is derived, not stored

Wrapped-up state is read from the columns the app already writes
(`status`, `first_responded_at`, `last_contact_date`, `response_count`) rather
than from a flag of its own — see `src/utils/inquiryWorkflow.ts`. Inquiries
converted and answered before this existed are therefore wrapped up too, with no
backfill. Archiving them instead would have overwritten the converted status and
broken the conversion rate.

`tests/inquiries-workflow.spec.ts` holds the rules against the shipped page.

## What to charge

Opening an inquiry shows a **What to charge** card. It is for you only: it is
saved to `inquiry_pricing`, a table no quote, email or portal page reads.

- **Formula price** — the form's hours at your target rate (your average profit
  per hour over the last three months, the same target as the Job Map), plus the
  round-trip drive at that rate and mileage. It appears as soon as the inquiry
  opens and costs nothing.
- **Where is the work?** — the quote form does not ask for an address, so travel
  is left out until you type one here. A town alone is enough for a rough drive;
  a street address gives the exact one. The Job Map's advice for that town, or
  for that drive-time band, shows underneath.
- **The gap** — what the form showed the customer, with any coupon added back,
  against the recommended price.
- **Ask Claude** — runs only when you click it. Claude is given the formula
  price, the customer's notes, your finished jobs (quoted, charged, hours taken)
  and recent lost quotes, and returns a price, a range, its reasons and anything
  worth asking the customer first. The customer's name, email and phone are not
  sent. The answer is saved, so reopening the inquiry does not ask again.

The Claude call runs in the `inquiry-price-advice` edge function. It uses the
`Claude_Inquiry_Pricing` secret when one is set, and otherwise the key the
coupon and gallery writers already use.
