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

1. Apply the migration `20260722120000_create_api_platform_system.sql`.
2. Deploy the two new edge functions:
   ```bash
   supabase functions deploy manage-api-keys
   supabase functions deploy api-v1 --no-verify-jwt
   ```
   `api-v1` **must** be deployed with `--no-verify-jwt` (or `verify_jwt = false`
   in the dashboard) because external callers authenticate with API keys, not
   Supabase JWTs. Key validation happens inside the function.
   `manage-api-keys` keeps JWT verification on — it is called only by logged-in
   platform admins.

---

## Outbound Connections (scaffolding)

The `integration_connections` table, the **Admin → Connections** page, and the
Vault-based token storage convention are in place. To activate a provider:

1. **Register a developer app** with the platform:
   - *Google Business Profile*: Google Cloud Console → OAuth consent + Business
     Profile APIs (typically the fastest approval).
   - *Facebook / Instagram*: Meta for Developers app + App Review for
     `pages_manage_posts` / `instagram_content_publish` (allow several weeks).
   - *TikTok*: TikTok for Developers app + audit.
2. **Store the app's client ID/secret** as edge-function secrets
   (`supabase secrets set`).
3. **Build the OAuth callback edge function** for that provider: exchange the
   code for tokens, store them in Supabase Vault, record the Vault secret name in
   `integration_connections.vault_secret_name`, and set `status = 'connected'`.
4. **Add a sync function** (scheduled via Supabase cron) that refreshes tokens
   and pulls metrics into local tables.

Tokens never live in ordinary table columns and never reach the browser — the
`integration_connections` row only stores a *reference* to the Vault secret.

Until providers are registered, the Connect buttons on the Connections page stay
disabled. A faster interim path for many automations: use the inbound API above
with Zapier/Make, which already integrate with most social platforms.
