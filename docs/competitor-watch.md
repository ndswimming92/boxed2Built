# Competitor Watch

An admin-only page at **Admin > Competitor Watch** (`/admin/competitors`, under
Marketing & Engagement) with two lists on it:

1. **Things to work on** — a checklist of things competitors are doing that
   Boxed2Built is not doing yet.
2. **Competitors** — every competing business found, each as a card that opens
   on everything known about it.

Both are filled by a weekly automated search. Nothing on the page is public and
only the business's owners and admins can read it.

## How the page gets filled

A Claude scheduled task ("Boxed2Built competitor watch") runs every Monday
morning. Each run:

1. Reads what is already saved, including items that were ticked off or
   removed, so nothing is suggested twice.
2. Reads the live Boxed2Built website, so it knows what the business already
   offers.
3. Searches for competitors of four kinds: local assembly businesses around
   Spring Hill, national platforms, retailers' own assembly services, and
   standout businesses in other cities (kept for ideas only).
4. Opens each competitor's own pages and saves what it finds into
   `competitors`, updating the same row each week.
5. Compares the two and saves anything competitors do that Boxed2Built does
   not into `competitor_action_items`.

It only reads public pages. It never contacts a competitor, fills in a quote
form or creates an account.

## Things to work on

One line per item: a tick box, a short title, three labels and a sentence on
what competitors are doing.

- **Labels:** how much it matters (**High / Medium / Low impact**), how much
  work it is (**Quick win**, **Some work**, **Bigger project**) and what it is
  about (Services, Pricing, Booking, Marketing, Trust, Customer experience).
  **New** shows for a week after an item is first saved.
- **Seen at** names the competitors doing it.
- **How Boxed2Built could do it** opens a short suggestion and, when there is
  one, a link to an example on a competitor's site.
- The list is sorted so the best next thing is on top: highest impact first,
  and among equals the quickest to do.

Three tabs:

- **To do** — everything still open.
- **Done** — ticked off. Untick an item to send it back.
- **Removed** — taken off with the bin because it does not apply. **Put back**
  returns it to To do.

Ticking and removing are saved straight away and are the same for every owner
or admin. Removed items are kept rather than deleted, on purpose: the weekly
run reads them so it does not suggest the same thing again.

## Competitors

Collapsed, a card shows the business's name, what kind of competitor it is,
where it is based, its website and a line on who they are. Clicking it opens:

- **Website, owner / founder, email and phone.** One that could not be found
  reads "Not found" rather than being left out, so it is clear it was looked
  for.
- **Area they serve, services, pricing, how customers book, what stands out,
  reviews** and **good to know**, each as a short list.
- **Find them online** — their other public pages (Facebook, Google listing).
- The date the details were last checked, and a **Not a competitor** button.

The chips above the list filter by kind (Local, National platform, Retailer
service, Out of area), and the search box matches the name, town, owner, email
and what they offer. A business marked **Not a competitor** moves under a
**Removed** chip, where it can be put back; like a removed item, it is kept so
the weekly run does not add it again.

Contact details are only the ones a business publishes for its customers: its
own website, its Google or Facebook business page, or a public business
listing. No personal addresses or private contact details are collected.

## Pieces

| Piece | Where |
| --- | --- |
| Tables, RLS, triggers | `supabase/migrations/20261009143830_create_competitor_watch.sql` |
| Admin page | `src/pages/admin/CompetitorsPage.tsx` |
| Queries and the two updates | `src/services/competitorService.ts` |
| Labels, sorting, search, link checks | `src/utils/competitors.ts` (tests in `tests/unit/competitors.test.ts`) |
| Types | `src/types/competitors.ts` |
| Browser tests | `tests/competitors.spec.ts` (harness in `tests/harness/competitors.tsx`) |

## Things that are deliberate

- **The browser can change two things and nothing else.** It is granted
  `SELECT` on both tables, `UPDATE` on `competitor_action_items.status` and
  `UPDATE` on `competitors.removed_at`. Everything the weekly run wrote is out
  of its reach, and there is no anonymous access at all.
- **Owners and admins only.** Every policy uses `can_manage_org_settings`, so
  the `viewer` and `member` roles cannot read or change the tables even by
  calling the API directly.
- **Who and when come from the database.** `status_changed_at`,
  `status_changed_by`, `removed_at` and `removed_by` are set by trigger from
  the server clock and the signed-in user.
- **The weekly run never touches a tick.** Its upsert leaves `status` and
  `removed_at` alone, so a refresh cannot reopen a done item or bring back a
  removed one.
- **One organization at a time.** The queries filter on the selected
  organization as well as relying on RLS, for the same reason Grants does.
- **A failed load shows only the error.** If either list fails to load, no
  tabs, counts or "nothing yet" messages appear, because what is saved is
  unknown at that point.
- **Everything renders as plain text.** The details are written by an
  automated process from web pages, so they are never treated as HTML.
- **Links and addresses are checked twice.** The tables only accept `http(s)`
  URLs. On the page, `safeExternalUrl` drops any other link, an email becomes a
  `mailto:` link only when it is one plain address, and a phone number becomes
  a `tel:` link only when it has enough digits; anything else shows as text.
- **One row per business and per idea.** The unique indexes are on the
  competitor's name and the item's title. The weekly run is told to reuse the
  stored spelling of both.
- **"Last checked" turns amber after ten days**, which means a Monday run was
  missed or failed.

## Changing what the search looks for

The kinds of competitor, the area, what counts as worth suggesting and how each
field is written all live in the scheduled task's prompt, not in this repo.
Edit the task from Claude's scheduled tasks list.

If the prompt starts saving a new kind of value, change the matching check
constraint first: `competitors.category` accepts `local`, `platform`,
`retailer` and `out_of_area`; an item's `category` accepts `services`,
`pricing`, `booking`, `marketing`, `trust`, `customer_experience` and `other`;
`priority` accepts `high`, `medium` and `low`; `effort` accepts `quick`,
`moderate` and `big`.

To erase a competitor or an item for good, delete its row in the database. If
it is still out there, the next run will save it again; use **Remove** or
**Not a competitor** on the page to keep it away.
