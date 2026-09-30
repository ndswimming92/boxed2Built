# YouTube Stats (Admin → Marketing & Engagement → YouTube Stats)

One page with a jump-to menu: **Overview · Performance · Audience · Discovery · Top videos · History**.

- **Content toggle** (All / Videos / Shorts) filters Performance, Audience, Discovery and Top videos.
- **Date range** 7 / 28 / 90 days, compared against the previous period.
- **Audience**: age & gender, subscribers vs. non-subscribers, devices, countries. YouTube hides
  age/gender until the audience is large enough; the page says so instead of showing an empty chart.
- **Top videos**: click a row for a side panel with that video's trend, audience retention, traffic
  sources, countries and demographics.
- **History**: a daily snapshot of subscribers / total views / video count, so growth is visible beyond
  what YouTube keeps.

## Edge functions
| Function | Purpose |
| --- | --- |
| `get-youtube-metrics` | Channel stats for the page (admin only) |
| `get-youtube-video-metrics` | Per-video drill-down (admin only) |
| `snapshot-youtube-stats` | Daily snapshot, run by pg_cron at 08:00 UTC |
| `_shared/youtube.ts` | Token refresh + Analytics helpers shared by the three |

## One-time setup
1. Google Cloud: enable **YouTube Data API v3** and **YouTube Analytics API**.
2. Deploy the functions (automatic on merge to main).
3. Apply `supabase/migrations/20260930170000_create_youtube_daily_snapshots.sql` (migrations are manual
   in this repo — see docs/DEPLOYMENT.md). It needs the `service_role_key` Vault secret, which the
   other scheduled jobs already use.
4. Admin → Connections → reconnect YouTube so the read/analytics permissions apply.

To take the first snapshot immediately instead of waiting for 08:00 UTC, invoke `snapshot-youtube-stats`
once (POST with the service role key).

## Notes
- Analytics data lags ~2 days; realtime numbers are only in YouTube Studio.
- Each section loads independently, so one failing query doesn't blank the page.
- `youtube_daily_snapshots` has RLS on with no policies: only the edge functions touch it.
