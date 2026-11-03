# Partner Leads

An admin-only page at **Admin > Partner Leads** (`/admin/partner-leads`, under
Marketing & Engagement) listing local businesses that could send customers to
Boxed2Built — movers, apartment and townhome communities, HOAs, property
managers, realtors, builders, stagers, furniture stores and senior living — with
who to contact and a draft partnership email for each. Emails are edited,
reviewed and sent from the page.

## How the page gets filled

A Claude scheduled task ("Boxed2Built partner leads") runs every morning. Each
run reads what is already saved (including leads marked **Not a fit** or **Do
not contact**, so they are never added again), searches within about 25 miles
of Spring Hill, opens each business's own pages, and inserts 5–10 new leads
into `partner_leads` with a draft subject and message written for that
business.

It only reads public pages. It never sends anything, fills in a form or creates
an account. It only inserts: a lead that is already saved is never rewritten, so
an edited draft, a corrected address or a status is never undone.

Contact details are only ones the business publishes: its own website, its
Google or Facebook business page, or a public business listing. The page the
email was found on is saved in `email_source_url` and linked on the card as
**Where the email was found**, so it can be checked before sending.

## Tabs and cards

- **New** — not contacted yet. **Contacted** — emailed (set automatically on the
  first send). **In talks**, **Partners** — set by hand. **Passed** — **Not a
  fit** and **Do not contact**, kept so the daily run does not find them again.
- Chips filter by kind of business; the search box matches name, town, contact,
  email and kind.
- A card opens on the person to ask for, email, phone, website, why they are a
  fit, a partnership idea, their other pages, the outreach email, every email
  already sent to them, and status and notes. **Edit contact** corrects the
  email, name or role.

## Sending

1. Edit the subject and message on the card (**Save draft** keeps them).
2. **Review & send** opens the email exactly as it will go out, rendered by the
   `send-partner-outreach-email` function rather than the browser, with the To,
   From and Reply-to addresses.
3. **Send me a test** sends it to the signed-in admin only.
4. Tick that it has been checked, then **Send to …**.

The email goes from and replies to `nicholas.davidson@boxed2built.com` through
Resend. The function adds the signature and a footer with a one-line opt-out
and the business's mailing address.

**Set the mailing address:** add an `OUTREACH_POSTAL_ADDRESS` secret to the
edge function (Supabase dashboard > Edge Functions > Secrets), e.g.
`PO Box 123, Spring Hill, TN 37174`. Until it is set the footer reads
"Boxed2Built LLC, Spring Hill, TN" and the review step says so. Business email
rules (CAN-SPAM) call for a valid postal address; a P.O. box is fine.

If someone replies asking not to be contacted, set them to **Do not contact**.

## Pieces

| Piece | Where |
| --- | --- |
| Tables, RLS, trigger | `supabase/migrations/20261103220655_create_partner_leads.sql` |
| Send function | `supabase/functions/send-partner-outreach-email/index.ts` |
| Email rendering (shared, tested) | `supabase/functions/_shared/partnerOutreach.ts` |
| Admin page | `src/pages/admin/PartnerLeadsPage.tsx` |
| Queries and calls | `src/services/partnerLeadService.ts` |
| Labels, sorting, search, link checks | `src/utils/partnerLeads.ts` |
| Types | `src/types/partnerLeads.ts` |
| Tests | `tests/unit/partnerLeads.test.ts`, `tests/partner-leads.spec.ts` (harness in `tests/harness/partner-leads.tsx`) |

## Things that are deliberate

- **The browser cannot send mail or write the send log.** It is granted `SELECT`
  on both tables and `UPDATE` on `status`, `draft_subject`, `draft_body`,
  `email`, `contact_name`, `contact_title` and `notes` only. `last_emailed_at`,
  `emails_sent` and `partner_lead_emails` are written by the function.
- **The recipient is never taken from the request.** The function reloads the
  lead and sends to its saved address. The page passes the address it showed in
  the review step as `confirmTo`; if the saved address differs, the send is
  refused and has to be reviewed again.
- **Every send is a person's.** A service-role call can preview but not send.
- **Refused:** leads marked Not a fit or Do not contact, and a lead emailed in
  the last seven days unless "send again" is ticked in the review step.
- **No double sends.** Each send carries a Resend idempotency key built from the
  lead, recipient and content, so a double click or retry sends one email.
- **Plain on purpose.** A short one-to-one note, not a newsletter template.
- **Owners and admins only**, via `can_manage_org_settings`, filtered by the
  selected organization as well as RLS.

## Changing what the search looks for

The area, kinds of business, number per day and how drafts are written live in
the scheduled task's prompt, not in this repo. Edit the task from Claude's
scheduled tasks list. If it starts saving a new kind of business, add it to the
`category` check constraint and to `PARTNER_CATEGORY_LABELS` first.
