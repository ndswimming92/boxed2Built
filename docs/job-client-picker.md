# Jobs and Clients

How a job gets attached to one of your saved clients — from the job form, or the
other way round by booking the job from the client's own profile — and how to add
a client without leaving either.

Every job form — **Add New Job**, **Edit Job**, **Copy Job**, and the forms
opened by converting an inquiry or an invoice — opens with a **Client** search
at the top of *Client Information*.

## Picking a saved client

1. Click the **Client** box. It lists every client in the organization, most
   recently contacted first.
2. Type to narrow the list. The search matches name, email, address, and phone —
   phone matching compares digits, so `6155551234`, `615-555-1234` and
   `(615) 555-1234` all find the same person.
3. Pick a client with the mouse, or with ↑/↓ and Enter.

Picking fills the fields below from their profile:

| Job field | Comes from |
| --- | --- |
| Client Name | `clients.name` |
| Phone | `clients.phone` |
| Email | `clients.email` |
| Client Address | `clients.address` |
| Repeat Client | Checked when the client already has jobs on file |
| Referral Source | `clients.source`, when it is one of the standard sources and the job has none |

Everything stays editable — the picker fills the form in, it does not lock it.

Two rules keep a pick from throwing away typing:

- **Picking a client for the first time** keeps anything already typed that the
  profile has no answer for. Type an address, then pick a client whose profile
  has none, and the address survives — and the database writes it back to that
  profile when the job saves.
- **Swapping one linked client for another** replaces the details outright, so a
  job never carries a mix of two people's contact details.

The **×** on the summary unlinks the client. The details already filled in stay
where they are; the job goes back to being matched by email or phone when it
saves.

## What linking actually does

The pick sets `jobs.client_id`. That column is what the rest of the system reads:

- `sync_job_addresses()` carries the profile's address onto the job.
- `push_job_address_to_client()` writes an address entered on the job back to
  that profile.
- `propagate_client_contact_changes()` pushes later profile edits out to the
  job.
- `auto_upsert_client_from_job()` returns early when `client_id` is already set,
  so an explicit pick is never overridden by matching on the contact fields.

A job saved without a pick behaves exactly as it always has: the database
matches it to a profile by email, then by phone, and creates one when neither
matches. The picker makes that link visible and correctable up front rather than
something that happens on save.

While a client is picked, the form stops re-matching on what the contact fields
say — the explicit choice wins. Unlink first to go back to matching.

## Adding a client from the job form

**Add a new client** sits at the bottom of the dropdown, and pressing Enter when
nothing matches what you typed opens it too. It opens the same **Add Client**
form as the Clients page, so both ways of adding a client are available:

- type the details in by hand, or
- drop in a photo — business card, handwritten note, work order, a screenshot of
  a text — and let **Scan Photo** read the fields off it. See
  [Adding Clients (Manual + Photo Import)](./client-photo-import.md).

Whatever is already known is carried into that form so it isn't typed twice: the
job's client fields, and the search text itself — as the email when it contains
an `@`, as the phone when it is all digits, and as the name otherwise. The
search text wins where the two disagree, since it is the more recent answer to
who this client is.

Creating the client saves it, links the new job to it, and fills the job's
client fields — the same as picking an existing one.

## Booking a job from the client's profile

The reverse direction works too, so a job for someone already on file never means going to
the Jobs page and searching for them again. **Admin → Clients → (a client)** offers three
ways in, all opening the same job form:

- **New Job** in the profile header, next to Edit and Delete.
- **New Job** beside *Select Job* in **Send Invoice by Email** — right where a job is being
  looked for.
- **Create First Job** in that section's empty state, when the client has no jobs yet.

The form opens as **New Job for ‹client›**, already linked to that profile with their
name, phone, email, and address filled in — the same state as picking them from the Client
box. Everything else on the form works as normal.

Saving reloads the profile, so the new job appears in the *Select Job* dropdowns and the
Activity Timeline straight away, and the job is left **selected** in the invoice section with
a note confirming it. From there the next step — *Create Invoice* — is one click, without
leaving the client.

While the job form is open it owns Escape and clicks outside it; the client profile
underneath stays put rather than closing and discarding a half-filled form.

## Notes

- Test clients appear in the list with a **Test** badge, so a test job can be
  attached to a test profile.
- Long lists render the first 50 matches with a count of the rest; keep typing
  to narrow them.
- If the client list can't be loaded the form says so and stays usable — type
  the details in as before, and the database links the job on save.
