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

1. Apply the migrations `20260722120000_create_api_platform_system.sql` and
   `20260723120000_create_oauth_states_and_vault_helpers.sql`.
2. Deploy the edge functions:
   ```bash
   supabase functions deploy manage-api-keys
   supabase functions deploy api-v1 --no-verify-jwt
   supabase functions deploy google-business-oauth-start
   supabase functions deploy google-business-oauth-callback --no-verify-jwt
   ```
   `api-v1` and `google-business-oauth-callback` **must** be deployed with
   `--no-verify-jwt` (or `verify_jwt = false` in the dashboard): `api-v1`
   callers authenticate with API keys, and `google-business-oauth-callback` is
   hit directly by Google's redirect with no Supabase session at all. Both
   `manage-api-keys` and `google-business-oauth-start` keep JWT verification
   on — they're only called by logged-in platform admins.
3. Set the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` edge function secrets
   (see "Outbound Connections" below) if not already configured.

---

## Outbound Connections

The `integration_connections` table, the **Admin → Connections** page, and the
Vault-based token storage convention are in place. Google Business Profile has
a working Connect flow; other providers follow the same pattern.

### Registering a provider's developer app

- *Google Business Profile*: Google Cloud Console → enable the Business
  Profile APIs → OAuth consent screen → OAuth client ID (Web application) with
  redirect URI `<SUPABASE_URL>/functions/v1/google-business-oauth-callback` →
  separately submit the [Basic API Access request form](https://developers.google.com/my-business/content/basic-setup#request-access)
  (this approval is what's usually slow — often days to weeks).
- *Facebook / Instagram*: Meta for Developers app + App Review for
  `pages_manage_posts` / `instagram_content_publish` (allow several weeks).
- *TikTok*: TikTok for Developers app + audit.

Store each provider's client ID/secret as edge-function secrets
(`supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`).

### How the Google Business Profile connect flow works

1. **Admin → Connections** page's Connect button calls
   `google-business-oauth-start` (admin-JWT protected), which generates a
   random `state`, stores it in `oauth_states` tied to the calling admin, and
   returns Google's OAuth consent URL. The browser is redirected there.
2. After the admin approves access, Google redirects to
   `google-business-oauth-callback` with a `code` and the `state`.
3. The callback validates and consumes the `state` row (single-use, 10-minute
   expiry — defends against CSRF), exchanges the code for tokens, and stores
   them in Supabase Vault via the `store_vault_secret` SQL helper — never in an
   ordinary table column.
4. It best-effort fetches the account name from the Business Profile Account
   Management API to label the connection. If Google's Basic API Access
   approval (above) hasn't landed yet, this call fails harmlessly: the
   connection is still marked `connected` (the OAuth handshake succeeded) with
   a `sync_error` note explaining that account details are pending approval.
   Nothing needs to be redone once approval clears — a future sync simply
   starts working.
5. The admin is redirected back to `/admin/connections` with a success or
   error banner.

### Extending to another provider

1. Add the provider's OAuth start/callback edge functions following the
   `google-business-oauth-*` pair as a template (same `oauth_states` table,
   same `store_vault_secret` helper).
2. Add the provider to `CONNECTABLE_PROVIDERS` in
   `src/pages/admin/ConnectionsPage.tsx` and wire its Connect button to the new
   start function, following `startGoogleBusinessConnect` in
   `src/services/apiPlatformService.ts` as a template.
3. **Add a sync function** (scheduled via Supabase cron) that refreshes tokens
   and pulls metrics into local tables — not yet built for any provider.

A faster interim path for automations that don't need a specific platform's
native API: use the inbound API above with Zapier/Make, which already
integrate with most social platforms.
