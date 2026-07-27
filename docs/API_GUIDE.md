# Boxed2Built API Guide

The API platform has two halves:

1. **Inbound API (`api-v1`)** — scoped API keys you issue from the admin panel so
   external tools (Zapier, Make, schedulers, custom scripts) can read and write
   your data.
2. **Outbound connections** — linked third-party accounts (Instagram, Facebook,
   Google Business Profile, TikTok) whose OAuth tokens are stored server-side and
   synced by edge functions. This half is scaffolded and activates per provider
   once a developer app is registered (see "Outbound Connections" below).

---

## Inbound API

### Base URL

```
https://<your-project-ref>.supabase.co/functions/v1/api-v1
```

The exact URL is shown (with a copy button) on **Admin → System & Tools → API Keys**.

### Authentication

Create a key in **Admin → API Keys**. The full key (`b2b_live_…`) is shown exactly
once at creation — only its SHA-256 hash is stored, so it can never be displayed
again. Send it on every request in either header:

```
X-Api-Key: b2b_live_xxxxxxxx...
# or
Authorization: Bearer b2b_live_xxxxxxxx...
```

Keys can be scoped, expired, and revoked. Revocation takes effect immediately.

### Scopes

| Scope | Grants |
| --- | --- |
| `inquiries:read` | List/view form inquiries |
| `inquiries:write` | Submit new inquiries |
| `jobs:read` | List/view jobs |
| `invoices:read` | List/view invoices (internal notes and payment tokens are never exposed) |
| `clients:read` | List/view clients |

### Endpoints

All list endpoints support `limit` (default 25, max 100) and `offset`, and return:

```json
{ "data": [...], "pagination": { "limit": 25, "offset": 0, "total": 132 } }
```

| Endpoint | Scope | Notes |
| --- | --- | --- |
| `GET /me` | any | Introspect the presented key (name, scopes, expiry) |
| `GET /inquiries` | `inquiries:read` | Optional `?status=` filter |
| `GET /inquiries/:id` | `inquiries:read` | |
| `POST /inquiries` | `inquiries:write` | See body below |
| `GET /jobs` | `jobs:read` | Active jobs only |
| `GET /jobs/:id` | `jobs:read` | |
| `GET /invoices` | `invoices:read` | Optional `?status=` filter |
| `GET /invoices/:id` | `invoices:read` | |
| `GET /clients` | `clients:read` | |
| `GET /clients/:id` | `clients:read` | |

`POST /inquiries` body — required: `client_name`, `client_email`,
`furniture_type`, `pieces` (positive integer). Optional: `client_phone`,
`preferred_date` (YYYY-MM-DD), `preferred_time_slot`, `notes`, `user_city`,
`referral_source`, `utm_source`, `utm_medium`, `utm_campaign`. Created inquiries
get `source: "api"` so they're distinguishable in the admin panel.

### Example

```bash
curl -s "$BASE_URL/inquiries?limit=5" -H "X-Api-Key: $API_KEY"

curl -s -X POST "$BASE_URL/inquiries" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Jane Doe",
    "client_email": "jane@example.com",
    "furniture_type": "Bookshelf",
    "pieces": 2,
    "notes": "Submitted via Zapier"
  }'
```

### Rate limiting & audit

- Each key has a per-minute rate limit (default 60, configurable at creation).
  Exceeding it returns `429`.
- Every request is written to `api_request_logs` and shown under
  **Admin → API Keys → Recent Requests**.
- `last_used_at` on each key updates as it's used, so stale keys are easy to spot
  and revoke.

### Error responses

Errors are JSON: `{ "error": "message" }` with conventional status codes —
`401` (missing/invalid/revoked/expired key), `403` (missing scope),
`404` (not found), `422`/`400` (validation), `429` (rate limited).

---

## Deployment notes

1. Apply the migrations `20260722120000_create_api_platform_system.sql`,
   `20260723120000_create_oauth_states_and_vault_helpers.sql`,
   `20260724120000_add_gallery_social_publish_columns.sql`,
   `20260725120000_add_update_vault_secret_helper.sql`, and
   `20260726120000_add_external_resource_id_to_connections.sql`.
2. Deploy the edge functions:
   ```bash
   supabase functions deploy manage-api-keys
   supabase functions deploy api-v1 --no-verify-jwt
   supabase functions deploy google-business-oauth-start
   supabase functions deploy google-business-oauth-callback --no-verify-jwt
   supabase functions deploy facebook-oauth-start
   supabase functions deploy facebook-oauth-callback --no-verify-jwt
   supabase functions deploy publish-gallery-photo
   supabase functions deploy youtube-upload-start
   supabase functions deploy sync-google-business-profile
   ```
   `api-v1`, `google-business-oauth-callback`, and `facebook-oauth-callback`
   **must** be deployed with `--no-verify-jwt` (or `verify_jwt = false` in the
   dashboard): `api-v1` callers authenticate with API keys, and the two OAuth
   callbacks are hit directly by the provider's redirect with no Supabase
   session at all. The `*-oauth-start` functions, `publish-gallery-photo`,
   `youtube-upload-start`, and `sync-google-business-profile` keep JWT
   verification on — they're only called by logged-in platform admins.
3. Set the `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and
   `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` edge function secrets (see
   "Outbound Connections" below) if not already configured.

---

## Outbound Connections

The `integration_connections` table, the **Admin → Connections** page, and the
Vault-based token storage convention are in place. Google Business Profile,
YouTube, and Facebook/Instagram all have working Connect flows; other
providers follow the same pattern.

### Registering a provider's developer app

- *Google Business Profile / YouTube*: Google Cloud Console → enable the
  Business Profile APIs **and** the YouTube Data API v3 → OAuth consent screen
  → add scope `https://www.googleapis.com/auth/youtube.upload` alongside
  `business.manage` → OAuth client ID (Web application) with redirect URI
  `<SUPABASE_URL>/functions/v1/google-business-oauth-callback` → separately
  submit the [Basic API Access request form](https://developers.google.com/my-business/content/basic-setup#request-access)
  for Business Profile (this approval is what's usually slow — often days to
  weeks; YouTube uploads don't need this and work as soon as the scope is
  granted, same Testing-mode + test-user story as Facebook below).
- *Facebook / Instagram*: Meta for Developers → create an app → add the
  Facebook Login product → redirect URI
  `<SUPABASE_URL>/functions/v1/facebook-oauth-callback` → note the App ID and
  App Secret. **App Review is not required for the business's own use**: while
  the app is in Development Mode, its own admins/testers can grant the full
  `pages_manage_posts` / `instagram_content_publish` / `read_insights` /
  `instagram_manage_insights` / `pages_manage_engagement` /
  `pages_read_user_content` / `instagram_manage_comments` / `pages_messaging` /
  `instagram_manage_messages` permissions to themselves without waiting on
  Meta's review — that review is only required to let *other* people's
  accounts use the app. Requires an Instagram
  **Business or Creator** account already linked to the Facebook Page in Meta
  Business Suite. If new scopes are added to an app that was already
  connected, existing tokens don't retroactively gain them — reconnect from
  **Admin → Connections** once to re-authorize with the fuller set. Note
  `pages_manage_engagement` and `pages_read_user_content` (a dependency of
  `pages_manage_engagement` — Meta's OAuth dialog rejects the whole request
  with "Invalid Scopes: pages_read_user_content" if it's requested but not
  enabled) live under a different "use case" tab in the Meta App Dashboard's
  permissions list than the Instagram-specific scopes (e.g. under "Facebook
  Login for Business" rather than "Instagram API").
- *TikTok*: TikTok for Developers app + audit.

Store each provider's client ID/secret as edge-function secrets
(`supabase secrets set GOOGLE_CLIENT_ID=... FACEBOOK_APP_ID=...`, etc.).

### How the connect flows work

Both providers follow the same shape:

1. **Admin → Connections** page's Connect button calls the provider's
   `*-oauth-start` function (admin-JWT protected), which generates a random
   `state`, stores it in `oauth_states` tied to the calling admin, and returns
   the provider's OAuth consent URL. The browser is redirected there.
2. After the admin approves access, the provider redirects to the matching
   `*-oauth-callback` function with a `code` and the `state`.
3. The callback validates and consumes the `state` row (single-use, 10-minute
   expiry — defends against CSRF), exchanges the code for tokens, and stores
   them in Supabase Vault via `store_vault_secret` — never in an ordinary table
   column.
4. The admin is redirected back to `/admin/connections` with a success or
   error banner.

Google Business Profile best-effort fetches the account name to label the
connection; if Basic API Access hasn't been approved yet, this fails
harmlessly and the connection shows `connected` with a `sync_error` noting
that account details are pending — nothing needs to be redone once approval
clears.

One Google login authorizes **both** the `google_business` and `youtube`
`integration_connections` rows together (same OAuth grant, broadened scope),
mirroring the Facebook/Instagram pairing below — connecting either card on the
Connections page kicks off the same flow. The stored secret additionally
carries an `expires_at` so `youtube-upload-start` knows when to transparently
refresh the access token via the stored `refresh_token` before calling
YouTube's API (Google access tokens expire hourly, unlike Facebook's
long-lived Page tokens).

### Keeping Business Info in sync with Google Business Profile

Saving **Admin → Business Info** or **Admin → Business Hours** automatically
pushes the change to Google (one-way: this site → Google, never the reverse —
no conflict resolution needed). This is separate from the manual Post to
Social pattern above; business facts (name, phone, hours) are low-risk to
auto-sync, unlike creative content.

1. The page's existing save calls `sync-google-business-profile`
   (admin-JWT protected) right after its own save succeeds. Sync failure never
   blocks or rolls back the local save — it's reported as a secondary note in
   the same success banner (e.g. "Google Business Profile updated." or a
   `sync_error`-derived message).
2. The function refreshes the Google access token if stale (same pattern as
   YouTube), then resolves the account's Business Profile **location**
   resource name once via a locations-list call and caches it in
   `integration_connections.external_resource_id` — every subsequent sync
   reuses the cached id instead of re-resolving it.
3. It `PATCH`es the location with a fixed `updateMask` covering exactly the
   fields below, so nothing on Google is touched outside this list.
4. `integration_connections` (`google_business` row)'s `sync_error` /
   `last_synced_at` reflect the most recent sync attempt, superseding the
   original connect-time "pending approval" note once a real sync succeeds or
   fails with a new error.

**Field mapping (1:1, no transformation beyond format conversion)** — every
field on both admin pages carries a note stating whether it's in this list:

| Site field | Google field |
| --- | --- |
| `business_info.name` | `title` |
| `business_info.phone` | `phoneNumbers.primaryPhone` |
| `business_info.website` | `websiteUri` |
| `business_info.description` | `profile.description` |
| `business_address.street_address` | `storefrontAddress.addressLines[0]` |
| `business_address.address_locality` | `storefrontAddress.locality` |
| `business_address.address_region` | `storefrontAddress.administrativeArea` |
| `business_address.postal_code` | `storefrontAddress.postalCode` |
| `business_address.address_country` | `storefrontAddress.regionCode` |
| `business_hours` (all days) | `regularHours.periods` |

Everything else on those two pages (alternate name, slogan, email, founded
year, founder name, price range, logo/image URLs, latitude/longitude) has no
corresponding Google Business Profile field via this API and stays local
only — same as `service_areas`, which would need Google Places IDs (a
separate integration) to map to Google's `serviceArea`, and isn't wired up.

Facebook's callback additionally: exchanges the short-lived user token for a
long-lived one, lists the Pages the admin manages via `/me/accounts` (using
the *first* Page returned), and reads that Page's linked
`instagram_business_account`. One Facebook Login authorizes **both** the
Facebook and Instagram `integration_connections` rows together, since
Instagram publishing is done through the Page's access token — connecting
either card on the Connections page kicks off the same flow. If no Instagram
Business account is linked to the Page, the Facebook connection still
succeeds; the Instagram row is marked `error` with a note to link one in Meta
Business Suite and reconnect.

### Publishing a gallery photo to Facebook/Instagram

Auto-posting is intentionally **not** wired to gallery uploads — a bad or
not-yet-ready photo could otherwise go public immediately. Instead, each image
gallery item has a **Post to Social** button (Admin → Gallery):

1. The button calls `publish-gallery-photo` (admin-JWT protected) with the
   gallery item's id.
2. The function loads the connected Facebook Page's token from Vault (via
   `read_vault_secret`), builds a caption from the item's title + description,
   and posts to Facebook (`POST /{page-id}/photos`) and Instagram (create a
   media container via `POST /{ig-user-id}/media`, then
   `POST /{ig-user-id}/media_publish`) **independently** — one platform failing
   doesn't block the other.
3. Results are written back onto the `gallery_items` row
   (`facebook_post_id`/`facebook_posted_at`/`facebook_post_error` and the
   Instagram equivalents) and returned to the UI for immediate feedback.
4. Only `type: 'image'` items can be posted; video publishing to these APIs
   needs a different, async upload flow and isn't supported yet.

### Viewing Facebook/Instagram metrics

**Admin → Social Metrics** shows follower counts and a 30-day reach/engagement
trend for the connected Facebook Page and its linked Instagram account.

1. The page calls `get-social-metrics` (admin-JWT protected), which loads the
   same Vault-stored Page token used for posting and calls the Graph API's
   `/{page-id}` and `/{page-id}/insights` (and the Instagram equivalents on
   `/{ig-user-id}`) — no separate connection or token is needed beyond the
   existing Facebook/Instagram connection.
2. Follower/media counts come from stable Graph API fields (`fan_count`,
   `followers_count`, `media_count`) that don't depend on Insights permissions
   staying valid. The 30-day trend comes from a short list of Insights metric
   *candidates* per platform (Facebook: `page_views_total`, `page_fan_adds`,
   `page_post_engagements`, `page_impressions_unique`; Instagram: `reach`,
   `profile_views`, `accounts_engaged`), each fetched independently — Meta has
   deprecated Page/Instagram Insights metrics in several waves, so whichever
   candidates currently work are shown (with their own friendly label), and a
   banner explains when none do (most often because the connection predates
   the `read_insights`/`instagram_manage_insights` scopes and needs a one-time
   reconnect). Nothing on the frontend hardcodes a metric name, so the next
   Meta deprecation wave degrades gracefully instead of erroring.

### Replying to Facebook/Instagram comments

**Admin → Social Comments** lists recent comments on the connected Facebook
Page's posts and the linked Instagram account's media, with an inline reply
box and a sidebar badge showing how many still need a reply — all without
leaving the admin.

1. The page calls `get-social-comments` (admin-JWT protected), which loads the
   same Vault-stored Page token and pulls the last 10 posts/media items with
   their comments (`/{page-id}/posts` and `/{ig-user-id}/media`, each
   expanding `comments{...,comments{from}}` one level deep to see if a reply
   already exists).
2. A comment counts as already handled if any of its replies has a `from.id`
   matching the Page/IG account itself — no separate "seen" table is needed,
   the Graph API data alone determines what still needs a reply.
3. Sending a reply calls `reply-social-comment` (admin-JWT protected) with
   `{ platform, comment_id, message }`, which posts to
   `/{comment-id}/comments` (Facebook) or `/{comment-id}/replies` (Instagram).
4. The sidebar's "Social Comments" badge polls `get-social-comments` every 5
   minutes (`useSocialCommentsBadge` hook) and shows the unreplied count;
   failures (not connected yet, transient Graph API error) are swallowed
   silently rather than showing an error badge.
5. Requires the `pages_manage_engagement` (plus its `pages_read_user_content`
   dependency) and `instagram_manage_comments` scopes — see the
   Facebook/Instagram app-registration notes above for where to enable them
   and the one-time reconnect needed for existing connections.

### Replying to Facebook Messenger/Instagram DMs

**Admin → Direct Messages** lists recent Messenger and Instagram DM
conversations for the connected Page/IG account, with an inline reply box and
a sidebar badge for how many still need a reply.

1. The page calls `get-social-conversations` (admin-JWT protected), which
   calls the unified Conversations API twice with the same Page token —
   `/{page-id}/conversations?platform=messenger` for Facebook and
   `/{page-id}/conversations?platform=instagram` for the linked Instagram
   account — each expanding the most recent message per conversation.
2. A conversation needs a reply if the most recent message's `from.id` is
   *not* the Page/IG account itself — simpler than the comments case since
   there's no reply-nesting to check, just "who sent the last message."
3. Sending a reply calls `send-social-message` (admin-JWT protected) with
   `{ recipient_id, message }`, POSTing to `/{page-id}/messages` with
   `messaging_type: RESPONSE` — the same endpoint and Page token handle both
   Messenger and Instagram DMs; which platform a reply goes to is implied by
   the recipient id (PSID vs IGSID), not passed explicitly.
4. Meta only allows a standard `RESPONSE`-type send within 24 hours of the
   customer's last message; sending outside that window returns a clear error
   telling the admin the customer needs to message again first (Meta's
   `HUMAN_AGENT` message tag can extend this to 7 days, but requires enabling
   the separate "Human Agent" feature in the Meta App Dashboard — not wired up
   here since it's a bigger commitment than this feature currently needs).
5. The sidebar's "Direct Messages" badge polls `get-social-conversations`
   every 5 minutes (`useSocialMessagesBadge` hook), same pattern as the
   comments badge.
6. Requires the `pages_messaging` and `instagram_manage_messages` scopes —
   see the Facebook/Instagram app-registration notes above.

### Gallery item purpose (website / social / both)

Every image gallery item carries two independent booleans —
`show_on_website` and `eligible_for_social` — set via a single "Where does
this go?" selector wherever items are created or edited (single-item add/edit,
and both the common-values and per-image sections of the batch upload form):

| Selector option | `show_on_website` | `eligible_for_social` |
| --- | --- | --- |
| Website Gallery + Social Media | `true` | `true` |
| Website Gallery Only | `true` | `false` |
| Social Media Only | `false` | `true` |

- `show_on_website = false` is enforced at the database level: the anon
  SELECT policy on `gallery_items` requires it, so social-only items are
  excluded from the public `/gallery` page regardless of any client-side
  filtering.
- `eligible_for_social = false` hides the **Post to Social** button for that
  item in the admin UI, and `publish-gallery-photo` independently rejects the
  request server-side if called anyway.
- Both default to `true` for backward compatibility — every item created
  before this feature behaves exactly as it did (shown on the website, and
  postable to social).

### Uploading a video to YouTube

Admin → Gallery has an **Upload to YouTube** button (separate from Post to
Social, since it's a new video file rather than an existing gallery photo):

1. The browser picks a video file, and calls `youtube-upload-start`
   (admin-JWT protected) with the title, description, visibility
   (private/unlisted/public — defaults to private), and the file's content
   type/length.
2. The function loads the `youtube` connection's tokens from Vault, refreshes
   the access token if it's stale (or missing an `expires_at`, for
   connections made before this field existed — treated as stale, refreshed
   unconditionally), and calls YouTube's **resumable upload** initiation
   endpoint (`POST /upload/youtube/v3/videos?uploadType=resumable`), which
   returns a one-time upload session URL.
3. The browser then `PUT`s the raw video bytes **directly to that session
   URL** via `XMLHttpRequest` (for upload-progress events) — the video never
   passes through our edge functions or database, avoiding any function
   payload/time-limit concerns for large files.
4. On success, the resulting video is offered back to be added to the public
   gallery (`type: 'video'`, `platform: 'youtube'`) — a separate explicit step,
   not automatic.

YouTube's default quota is 10,000 units/day; each upload costs 1,600 units
(~6 uploads/day) before a quota increase request to Google is needed.

### Extending to another provider

1. Add the provider's OAuth start/callback edge functions following the
   `google-business-oauth-*` or `facebook-oauth-*` pair as a template (same
   `oauth_states` table, same `store_vault_secret`/`read_vault_secret` helpers).
2. Add the provider to `CONNECTABLE_PROVIDERS` in
   `src/pages/admin/ConnectionsPage.tsx` and wire its Connect button to the new
   start function, following `startGoogleBusinessConnect` /
   `startFacebookConnect` in `src/services/apiPlatformService.ts` as a template.
3. **Add a sync function** (scheduled via Supabase cron) that refreshes tokens
   and pulls metrics into local tables — not yet built for any provider.

A faster interim path for automations that don't need a specific platform's
native API: use the inbound API above with Zapier/Make, which already
integrate with most social platforms.
