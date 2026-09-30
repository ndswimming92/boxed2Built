# YouTube Stats (Admin → Marketing & Engagement → YouTube Stats)

Shows channel totals, performance vs. the previous period, a daily trend chart,
traffic sources, Shorts vs. videos, top countries and top videos.

## One-time setup
1. In the Google Cloud project used for the Google login, enable **YouTube Data API v3**
   and **YouTube Analytics API**.
2. Deploy `get-youtube-metrics` and `google-business-oauth-start` (the latter now also requests
   `youtube.readonly` and `yt-analytics.readonly`).
3. In Admin → Connections, reconnect YouTube and approve the new permissions.

## Notes
- Analytics data lags ~2 days; realtime numbers are only in YouTube Studio.
- Each section loads independently, so one failing query doesn't blank the page.
