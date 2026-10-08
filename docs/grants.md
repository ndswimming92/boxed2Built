# Grants

An admin-only list of grants Boxed2Built could apply for, at **Admin > Grants**
(`/admin/grants`, under Financial Management). It is filled by a daily automated
search. Nothing on it is public, and nothing needs approving.

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

Name, the company or organization giving it, the amount, a description, the
deadline, who can apply, how it fits Boxed2Built (including anything the owner
has to confirm himself), what the application asks for, anything else worth
knowing, a link to the funder's application page, and the date the details were
last checked.

Labels on a grant:

- **New** for a week after it is first saved.
- **Closes in N days** when the deadline is within 14 days.
- **National / Tennessee / Local / Federal** for who is giving the money.
- **Costs money to enter** when a contest charges an entry fee, with the fee.

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
