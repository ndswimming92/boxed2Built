# News feed

A public page of furniture assembly and flat pack furniture news at `/news`,
plus a **Sales** tab of current furniture sales, including stores in and around
Spring Hill, TN. Both are filled by a daily automated check and gated by manual
approval.

## How a story gets on the site

1. **Daily check.** A Claude scheduled task ("Furniture assembly and flat pack
   daily news") runs each morning. It searches for news from roughly the last
   48 hours and for furniture sales running now at stores in the area, writes a
   short summary of each item in its own words, and inserts them into
   `news_items` with `status = 'draft'`. It only ever inserts drafts; it cannot
   publish.
2. **Review.** Drafts show up under **Admin > News Feed** (`/admin/news`), with
   a red count on the sidebar item. Open the source link, edit the title or
   summary if needed, then **Approve** or **Reject**.
3. **Live.** An approved item appears on `/news` immediately. The page shell is
   pre-rendered, but the stories load in the browser, so no rebuild or deploy is
   involved.

**Unpublish** moves a live item back to drafts. Rejected items are kept rather
than deleted, because the unique constraint on the source link is what stops the
daily check from saving the same story again the next morning.

## Pieces

| Piece | Where |
| --- | --- |
| Table, RLS, trigger | `supabase/migrations/20261006153825_create_news_items_feed.sql` |
| `deals` topic | `supabase/migrations/20261006200000_add_deals_news_topic.sql` |
| `ends_on` column and expiry rule | `supabase/migrations/20261006210000_add_news_items_ends_on.sql` |
| Store, local/online and furniture-type filters | `supabase/migrations/20261008120000_add_news_sale_filters.sql` |
| Public page | `src/pages/NewsPage.tsx` |
| Sales filter bar | `src/components/ui/SaleFilters.tsx` |
| Admin review screen | `src/pages/admin/NewsPage.tsx` |
| Queries and audit logging | `src/services/newsService.ts` |
| Date and link helpers | `src/utils/news.ts` (tests in `tests/unit/news.test.ts`) |
| Retry and last-good list | `src/utils/publicRead.ts`, `src/utils/newsSnapshot.ts` |
| Sidebar draft count | `src/hooks/useNewsDraftsBadge.ts` |

## Things that are deliberate

- **Titles and summaries render as plain text.** They are written by an
  automated process from web pages, so they are never treated as HTML.
- **Source links are checked twice.** The table only accepts `http(s)` URLs, and
  `safeExternalUrl` drops anything else before it becomes a link. Outbound links
  carry `rel="noopener noreferrer nofollow"`.
- **The public query filters on `status = 'published'` even though RLS already
  does for visitors.** A signed-in admin can read drafts, and without the filter
  would see their own drafts on the public page.
- **`published_at` is set once.** Unpublishing and republishing keeps the
  original date, so the item returns to its old position.

## Sales

The tab is called **Sales**, but the stored topic value is still `deals` (only the
label in `NEWS_TOPIC_LABELS` changed), so the database and the daily check's
prompt are unchanged. A sale is a `news_items` row with `topic = 'deals'`. It goes through the same
draft, approve, publish flow and shows on the public page under **All news** and
on its own **Sales** tab.

- **Deals expire on their own.** `news_items.ends_on` is the last day the deal
  is valid. It shows through that whole day and drops off `/news` the next day,
  judged in Central time. This is enforced twice: the anonymous RLS policy hides
  ended rows, and the public query filters them for signed-in admins. Set or
  change the date with **Edit** in Admin > News Feed. The daily check should
  fill `ends_on` (YYYY-MM-DD) whenever the store states an end date; update the
  scheduled task's prompt to do so.
- **Sorting sales by expiry.** On the Sales tab the Sort menu adds **Ending
  soonest** and **Ending latest** (the Sales tab opens on Ending soonest). Sales
  with no end date always sit at the bottom, newest first, in both directions.
  Those two options are not offered on the other tabs, since news stories have
  no end date. "Load more" continues from the position of the last sale shown
  (end date, then posted date, then id, in `endingAfterCondition`), so there is
  no cap on how many sales can be paged through, and a sale approved or re-dated
  mid-visit cannot repeat, skip or reorder a row.
- **No end date means no expiry.** A deal with `ends_on` empty stays up until
  you **Unpublish** it.
- **Expired deals stay `published`.** They are only hidden, so they remain in
  the Published tab with an "Expired" label and their source link stays
  reserved, which stops the daily check re-adding the same sale. Unpublish or
  reject them when you want them out of the list.
- **One store page, many sales.** A store's sale page usually keeps the same web
  address from one sale to the next, and a source link can only be stored once.
  When a new sale lives at an address already stored for an older one, the daily
  check adds a `#name-of-sale` ending to the link so both can be kept. The link
  opens the same page.
- **Which sales count** is set in the scheduled task's prompt, like the news
  search terms. Any furniture sale belongs here, local stores and online
  retailers (Wayfair, IKEA, Amazon) alike. An item that is mainly a sale or a
  discount event should be saved with `topic = 'deals'`, not as news under
  `flat_pack` or `furniture_assembly`. Put that wording in the task's prompt.

## Filtering sales

Once there are many stores, the Sales tab has a filter bar under the tabs:

- **Store** chips, busiest first, each with a count. The first 8 are chips; the
  rest sit in a "More stores" menu. A store appears when its first sale is
  approved and disappears when its last one ends.
- **Where:** Anywhere, Local stores (near Spring Hill) or Online.
- **Furniture type:** living room, bedroom, dining, office, outdoor, mattresses,
  storage and organization, rugs and decor. A sale can cover several.

The counts account for the other filters (choose Online and each store shows how
many of its sales are online). The choices live in the page link, for example
`/news?store=wayfair&where=online&type=bedroom`, so a filtered view can be
shared or bookmarked and the back button steps through it. Only the Sales tab
has these filters; on the news tabs they are ignored.

**Where the data comes from.** Each sale has three optional fields:
`store_name`, `sale_scope` (`local` or `online`) and `furniture_types`. They are
not the same as `source_name`, which is the site the story was read at (a
Wayfair sale read on Yahoo Shopping has `source_name = 'Yahoo Shopping'` and
`store_name = 'Wayfair'`). `store_slug` is generated by the database from
`store_name`; never write to it.

- **A sale with no store is not lost.** It shows when no filter is on, and
  Admin > News Feed flags it "No store set" so it can be fixed at review. It will
  not appear once a visitor picks a store, a local/online choice or a type it
  has not been given.
- **Keep one spelling per store.** The Store field in Admin suggests names
  already in use. "Wayfair" and "Wayfair.com" would be two chips.
- **Update the daily check's prompt** to fill the three fields on every sale:
  `store_name` (the store running the sale, not the news site), `sale_scope`
  (`local` for a store near Spring Hill, `online` for online-only) and
  `furniture_types` (any of `living_room`, `bedroom`, `dining`, `office`,
  `outdoor`, `mattresses`, `storage`, `rugs_decor`; leave empty if unclear).
  Existing sales need the same fields filled in once by hand, from **Edit**.
- **Before the migration is applied** the page still works; it just shows no
  filter bar, because the function that supplies the choices does not exist yet.

## Handling a rush of visitors

The page shell is pre-rendered, but the stories are read from Supabase in the
visitor's browser. On the Supabase free plan that database is shared with the
quote form, the admin area and the customer portal, so the page is built not to
make a struggling database worse:

- **Spaced retries** (`src/utils/publicRead.ts`). A failed load is retried twice,
  after about 1 and 2.5 seconds with some jitter, before an error is shown. The
  Supabase client's own automatic retries are switched off for these reads so
  retries do not stack.
- **The last good list.** Each successful first page is kept in the visitor's
  browser (`src/utils/newsSnapshot.ts`, last 6 views, at most 3 days old). If a
  later load still fails, they see that list, minus any sales that have ended since,
  under a note that it may be out of date, instead of an error. A successful but
  empty answer clears that view's saved copy.
- **Monitoring.** `npm run monitor:synthetic` checks `/news` every 15 minutes once
  the `SYNTHETIC_BASE_URL` secret is set.

**What is not here: a shared cache.** A Netlify Function that cached the two reads
at the CDN was tried and removed. The site is published through Bolt.new, and the
function was never deployed (the route answered 404), so it only added a wasted
request. Putting a cache in front of Supabase needs a host that runs Netlify
Functions, or a static snapshot of the feed rebuilt on a schedule.

## Changing what the daily check looks for

The search terms, the 48-hour window and the writing rules live in the scheduled
task's prompt, not in this repo. Edit the task from Claude's scheduled tasks
list. If a new topic is added there, also add it to the `topic` check constraint
on `news_items`, the `NewsTopic` type and `NEWS_TOPIC_LABELS`.

## Posting to Facebook

Optional, per story, from **Admin > News Feed**:

- **Drafts tab:** the "Also post to the Boxed2Built Facebook page when approved"
  switch (off by default). If it is on when you click Approve (or Save and
  approve), the story is published and then posted. If the Facebook post fails
  the story still goes live and the error is shown.
- **Published tab:** **Post to Facebook** posts the story on demand. A story that
  was already posted shows its date and asks before posting again.

The post is the title, summary and source name, with the source article attached
as the link. It uses the Facebook connection under Admin > Connections, through
the `publish-news-to-facebook` edge function, which refuses anything not
published. The outcome is stored in the admin-only `news_facebook_posts` table, not on
`news_items`, because published rows are publicly readable and the error text
can contain raw Facebook API messages. A failed retry only updates the error. Needs migrations
`20261006180000_add_news_facebook_posting.sql` and
`20261006190000_move_news_facebook_status_to_admin_table.sql` applied and the function deployed.
