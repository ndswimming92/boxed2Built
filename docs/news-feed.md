# News feed

A public page of furniture assembly and flat pack furniture news at `/news`,
filled by a daily automated check and gated by manual approval.

## How a story gets on the site

1. **Daily check.** A Claude scheduled task ("Furniture assembly and flat pack
   daily news") runs each morning. It searches for news from roughly the last
   48 hours, writes a short summary of each item in its own words, and inserts
   them into `news_items` with `status = 'draft'`. It only ever inserts drafts;
   it cannot publish.
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
| Public page | `src/pages/NewsPage.tsx` |
| Admin review screen | `src/pages/admin/NewsPage.tsx` |
| Queries and audit logging | `src/services/newsService.ts` |
| Date and link helpers | `src/utils/news.ts` (tests in `tests/unit/news.test.ts`) |
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
published. The outcome is stored on the row (`facebook_post_id`,
`facebook_posted_at`, `facebook_post_error`). Needs migration
`20261006180000_add_news_facebook_posting.sql` applied and the function deployed.
