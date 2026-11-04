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

## Writing the email

The message editor has a toolbar — **bold**, *italic*, underline, link,
bulleted and numbered lists, and an **Insert button** (a brand-coloured button
that links wherever you choose, with one-click picks for the Website, Book,
Gift cards, Partners and Services pages). Beside it, a **live preview** shows
the finished, branded email as you type: the Boxed2Built logo and navy-and-gold
rule at the top, your text, a contact card with the website link, the social
icons, and the opt-out line.

The toolbar writes a small, safe markup into the message text that the server
turns into HTML:

```
**bold**   *italic*   __underline__   [words](https://link)
- a bullet line         1. a numbered line
[button: Book online](https://boxed2built.com/book)   (on its own line)
```

Only `http(s)`, `mailto:` and `tel:` links become links; anything else stays as
plain text, so a draft can never inject HTML or a script.

**Clicks show in GA4.** Every link to boxed2built.com in the email (buttons,
text links, the logo and the contact card's website link) gets UTM tags added
when the email is rendered: `utm_source=partner_outreach`, `utm_medium=email`,
`utm_campaign=partner_leads`, `utm_content` for what was clicked
(`button_book_online`, `link_our_partner_page`, `logo`, `card_website`) and
`utm_term=<business emailed>` (e.g. `grand_welcome_of_franklin`). In GA4, look
under Reports > Acquisition > Traffic acquisition (session source / medium
`partner_outreach / email`), or add "Session manual term" and "Session manual
ad content" to see which business and which link. Links to other sites are
left alone, and a utm_ value you type into a link yourself is kept.

## Partner codes

Each card has a **Partner code** section. **Create code** makes a coupon for
that partner (suggested from their name, e.g. `GRANDWELCOME`, $25 off by
default) through `create_partner_lead_code`, and links it to the lead. It is an
ordinary coupon, so it also appears under Admin > Coupons, where it can be
edited or turned off. Customers the partner sends type the code on the request
form, or arrive from the booking link (`/contact?coupon=CODE`), and get the
discount; the card shows how many times it was used. **Add code to email**
puts a line and a "Book with code" button above your closing.

## Opens, clicks and bounces

Open and click tracking is on for the boxed2built.com sending domain in Resend
(it applies to every email sent from that domain). Resend's webhook events land
in `email_events`, and `get_partner_lead_email_activity` returns the ones for
partner outreach emails to owners and admins. Each sent email on a card shows
Delivered, Opened, Clicked (hover for the links) or Bounced, and the collapsed
card shows "Opened your email", "Clicked your email" or "Email bounced" for the
latest one. Some mail apps (Apple Mail especially) load images automatically,
so "Opened" can appear when nobody read it; a click is the stronger signal.

## Sending

1. Edit the subject and message on the card (**Save draft** keeps them).
2. **Review & send** opens the email exactly as it will go out, rendered by the
   `send-partner-outreach-email` function rather than the browser, with the To,
   From and Reply-to addresses. (The live preview uses the same renderer, so it
   matches; only the footer's full mailing address is filled in server-side.)
3. **Send me a test** sends it to the signed-in admin only.
4. Tick that it has been checked, then **Send to …**.

The email goes from and replies to `nicholas.davidson@boxed2built.com` through
Resend. It is laid out in the Boxed2Built brand — logo, navy-and-gold accent,
a contact card linking to boxed2built.com, and the social-icon footer shared
with the other customer emails (`_shared/emailSocialFooter.ts`) — then a footer
with a one-line opt-out and the business's mailing address.

**Mailing address:** the footer reads "Boxed2Built LLC, 163 Bess Blvd, Spring
Hill, TN 37174" (`OUTREACH_POSTAL_ADDRESS` in `_shared/partnerOutreach.ts`), which
business email rules (CAN-SPAM) call for. To use a different address without a
code change, set an `OUTREACH_POSTAL_ADDRESS` secret on the edge function
(Supabase dashboard > Edge Functions > Secrets); it overrides the default.

If someone replies asking not to be contacted, set them to **Do not contact**.

## Pieces

| Piece | Where |
| --- | --- |
| Tables, RLS, trigger | `supabase/migrations/20261103220655_create_partner_leads.sql`, `20261103222921_partner_lead_emails_unique_resend_id.sql` |
| Partner codes, email activity | `supabase/migrations/20261104193000_partner_lead_codes_and_email_activity.sql` |
| Send function | `supabase/functions/send-partner-outreach-email/index.ts` |
| Email rendering + markup (shared, tested; imported by the page too) | `supabase/functions/_shared/partnerOutreach.ts` |
| Shared social footer | `supabase/functions/_shared/emailSocialFooter.ts` |
| Admin page | `src/pages/admin/PartnerLeadsPage.tsx` |
| Message editor + live preview | `src/components/admin/OutreachEditor.tsx` |
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
  lead, recipient, content and an attempt id made once per review step, so a
  double click or retry sends one email while reopening the review step to send
  again on purpose gets a new key. A replayed response is caught by the unique
  index on `partner_lead_emails.resend_id`, so it never adds a second history
  row or count.
- **Status never goes backwards.** Sending marks a lead Contacted only if it is
  still New at that moment (checked in the update itself), so a Do not contact
  set while an email was in flight is kept.
- **One renderer, two places.** The page imports `renderOutreach` from the
  function's shared module and renders the live preview in the browser, so what
  you see while typing is the same code the server sends with — they cannot
  drift. The Review step re-renders server-side as the final authority (and is
  where the real mailing address appears).
- **Markup is safe by construction.** The body is stored as plain text with a
  little markup. Everything is HTML-escaped; only `http(s)`, `mailto:` and
  `tel:` links are turned into links or buttons. A `javascript:`/`data:` or
  relative URL stays inert text.
- **Branded, but light on purpose.** Logo, a navy-and-gold rule, brand links
  and buttons, and the social footer — but a white page and a one-to-one tone,
  not a full newsletter template, which keeps cold outreach out of Promotions
  more often.
- **The closing is the sender's.** The message ends with whatever closing is
  typed; a standard one is added only when there isn't one, and never a second
  time when the name is already there.
- **Owners and admins only**, via `can_manage_org_settings`, filtered by the
  selected organization as well as RLS.

## Changing what the search looks for

The area, kinds of business, number per day and how drafts are written live in
the scheduled task's prompt, not in this repo. Edit the task from Claude's
scheduled tasks list. If it starts saving a new kind of business, add it to the
`category` check constraint and to `PARTNER_CATEGORY_LABELS` first.
