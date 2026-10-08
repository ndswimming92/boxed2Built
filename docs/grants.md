# Grants

An admin-only list of grants Boxed2Built could apply for, at **Admin > Grants**
(`/admin/grants`, under Financial Management). It is filled by a daily automated
search. Nothing on it is public, only the business's owners and admins can read
it, and nothing needs approving.

## How a grant gets on the list

1. **Daily search.** A Claude scheduled task ("Boxed2Built grant finder") runs
   each morning. It searches national, Tennessee, local and federal sources for
   grants and no-equity cash prizes the business can actually apply for, opens
   each funder's own website to confirm the program is real and open, and saves
   what it verified into `business_grants`.
2. **It shows straight away.** There is no draft or approval step. This is
   information for the owner, not something published to visitors, so a saved
   grant appears in the admin portal the next time the page loads.
3. **It stays current.** Every run re-opens the funder page for each grant
   already saved and updates the same row: a changed deadline or amount, a
   program that has closed, or a recurring program that has reopened.

## What each grant shows

Each card is laid out to be scanned, top to bottom:

1. **Name and company**, with labels above them: **New** for a week after the
   grant is first saved, **Closes in N days** when the deadline is within 14
   days, and **National / Tennessee / Local / Federal** for who is giving the
   money.
2. **Three facts side by side:** the amount, the deadline (or the date
   applications open, for an upcoming grant) and the cost to apply. Each is a
   short headline with the funder's small print under it. "Cost to apply" reads
   **Free**, or the fee in amber when a contest charges one.
3. **A one-paragraph description.**
4. **Fit for Boxed2Built**, in a highlighted box: why it fits, and anything the
   owner has to confirm himself.
5. **Who can apply**, **What the application asks for** and **Good to know**,
   each as a short list of points.
6. **The link to apply**, and the date the details were last checked.

**How the text becomes lists.** The grant finder writes one point per line, and
the card shows each line as a bullet. Text saved as a paragraph is split into
its sentences instead (`toPoints` in `src/utils/grants.ts`); it never splits
inside "U.S." or "Inc.", and one sentence alone is shown without a bullet.

**How the amount gets a headline.** The grant finder writes the award first and
the detail after a semicolon. `splitAmount` cuts at the first natural break, so
"$500 to one business each month; monthly recipients are also considered..."
shows "$500 to one business each month" in bold with the rest in small text.

## Tabs

- **Open now** — accepting applications, nearest deadline first. Rolling and
  undated grants come after the dated ones.
- **Opening soon** — real programs that are between cycles or not open yet,
  with the date they open when the funder gives one.
- **Closed** — the cycle ended. A grant also moves here by itself the day after
  its deadline, judged in Central time, without waiting for the next run.

Closed grants are kept rather than deleted. A recurring program keeps one row
across cycles, so its history is not lost and it is not saved twice.

## Pieces

| Piece | Where |
| --- | --- |
| Table, RLS, trigger | `supabase/migrations/20261008181155_create_business_grants.sql` |
| Owners and admins only | `supabase/migrations/20261008182942_restrict_business_grants_to_org_admins.sql` |
| Admin page | `src/pages/admin/GrantsPage.tsx` |
| Query | `src/services/grantsService.ts` |
| Tabs, labels, sorting, dates | `src/utils/grants.ts` (tests in `tests/unit/grants.test.ts`) |
| Types | `src/types/grants.ts` |
| Browser tests | `tests/grants.spec.ts` (harness in `tests/harness/grants.tsx`) |

## Things that are deliberate

- **The page is read-only.** The grant finder is the only writer. The browser is
  granted `SELECT` on `business_grants` and nothing else, and there is no
  anonymous access at all, so the list cannot leak onto the public site or be
  changed from it.
- **Owners and admins only.** The read policy uses `can_manage_org_settings`,
  so the `viewer` and `member` roles cannot read the table even by calling the
  API directly. The admin route guard protects the page; the policy protects
  the data.
- **One organization at a time.** The query filters on the selected
  organization as well as relying on RLS. RLS alone would hand an admin of two
  organizations, or a platform admin, both lists merged into one.
- **A failed load shows only the error.** No tabs, counts or "no grants yet"
  message appear beside it, because what is saved is unknown at that point.
- **Everything renders as plain text.** The details are written by an automated
  process from web pages, so they are never treated as HTML.
- **Links are checked twice.** The table only accepts `http(s)` URLs, and
  `safeExternalUrl` drops anything else before it becomes a link.
- **One row per program.** The unique index is on funder and name, not on the
  link, because a funder's application link often changes between cycles. The
  grant finder is told to reuse the stored spelling of both.
- **"Last checked" turns amber after three days.** If a run fails or cannot
  open a funder's page, the row is left as it was, and the page says the
  details should be confirmed with the funder.

## Changing what the search looks for

The business facts it judges eligibility against, where it looks, what counts
as a grant and how each field is written all live in the scheduled task's
prompt, not in this repo. Edit the task from Claude's scheduled tasks list.

If the prompt starts saving a new kind of value, change the matching check
constraint first: `funder_scope` accepts `national`, `state`, `local` and
`federal`, and `cycle_status` accepts `open`, `upcoming` and `closed`.

To remove a grant for good, delete its row in the database. If it is still open
and still fits, the next run will save it again.
