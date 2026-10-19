# Deployment

What ships automatically, what does not, and the one thing that will bite you.

## The short version

| Thing | How it deploys |
| --- | --- |
| Frontend (`src/`) | **Automatic** — Netlify builds on push to `main` (Cloudflare Pages once moved; see below) |
| Edge functions (`supabase/functions/`) | **Automatic** — `.github/workflows/deploy-functions.yml`, once its two secrets are set |
| Database migrations (`supabase/migrations/`) | **By hand. Always.** See below |

## Frontend on Cloudflare Pages

The site is moving from Netlify to Cloudflare Pages, whose free plan allows
business use and 500 builds a month. Both can run side by side until the domain
is switched: Netlify keeps using `netlify.toml` and `public/_redirects`, and
Cloudflare runs `npm run build:cloudflare`, which builds normally and then runs
`scripts/prepare-cloudflare.mjs` to swap in `cloudflare/_redirects` and append
`cloudflare/_headers` to `public/_headers`.

**Keep the two in step.** A redirect or header added to `netlify.toml` or
`public/_redirects` must also go in `cloudflare/`, until Netlify is retired and
those files can be deleted.

### Project settings

In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, pick this
repo, then:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build:cloudflare` |
| Build output directory | `dist` |

Environment variables (Production), copied from the Netlify site's settings:

- `NODE_VERSION` = `22`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTHORIZED_ADMIN_EMAILS` = `boxed2builtco@gmail.com`
- `VITE_AUTHORIZED_ADMIN_DOMAINS` = `boxed2built.com`
- Any others set in Netlify, such as `VITE_AUTHORIZED_CLIENT_EMAILS`,
  `VITE_AUTHORIZED_CLIENT_DOMAINS` and the `VITE_*_OAUTH_REDIRECT_URI` values

These are read at build time, so a change only takes effect after a redeploy.

### Testing on the `.pages.dev` address

Public pages, redirects and headers can all be checked there. Sign-in cannot:
passkeys are bound to boxed2built.com, and Google/Supabase sign-in only returns
to addresses on the Supabase redirect allow-list. Test admin, portal and booking
sign-in after the domain moves.

Spot checks: `/about` and `/about/` both 200 with the same page;
`/services/move-in-assembly` 301s to `/services/furniture-assembly`; `/admin/x`
loads the app with `X-Robots-Tag: noindex, nofollow`; an unknown URL returns 404.

### Switching the domain

1. Add `boxed2built.com` (and `www`) under the Pages project's **Custom
   domains** and follow the DNS steps it shows.
2. Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS**. This replaces
   the HTTP→HTTPS redirect in `netlify.toml`.
3. Test sign-in, checkout, gift cards and the client portal on the live domain.
4. Once it has run cleanly for a day or two, disconnect Netlify and cancel Bolt.

## Edge functions

`deploy-functions.yml` runs on push to `main` when anything under
`supabase/functions/` or `supabase/config.toml` changes, and can be run manually
from the Actions tab.

### Required secrets

The workflow fails immediately with an actionable message until both exist under
**Settings → Secrets and variables → Actions**:

- `SUPABASE_ACCESS_TOKEN` — a personal access token from
  <https://supabase.com/dashboard/account/tokens>
- `SUPABASE_PROJECT_REF` — the project ref (the id in the dashboard URL)

### Why it deploys everything

It runs `supabase functions deploy` with no function names, which deploys all of
them. That is deliberate. Deploys are idempotent and there are only about fifty,
so a full run costs a couple of minutes — and a path filter would miss the case
that matters most: a change to `supabase/functions/_shared/` alters a dozen
functions whose own files never changed.

### `supabase/config.toml` is load-bearing

**The CLI reads `verify_jwt` from `config.toml` and defaults to `true` for
anything not listed there.**

Eighteen functions run with `verify_jwt = false` on purpose — the public
webhooks (Stripe, Resend, gift cards), the anonymous contact form, the OAuth
callbacks, the calendar feed. Deploying those with JWT verification on would
reject every real caller: the contact form would stop taking leads and Stripe
would start failing its webhooks.

So when you add a function that must be callable without a signed-in user, add
it to `config.toml` in the same commit. A missing entry silently means `true`.

### What the old setup did

The Supabase GitHub integration deploys only **brand-new** functions. A function
that already exists and then changes is never redeployed. Main and production
drifted apart silently, twice in one week — once leaving a portal-invite
redirect fix undeployed, once leaving a dead notification address in place after
the code removing it had already merged. That is what this workflow exists to
stop.

## Migrations — manual, and why

There is deliberately **no `supabase db push`** step, and adding one today would
be dangerous.

Local migration filenames and the remote `schema_migrations` versions have
diverged badly:

| | Count |
| --- | --- |
| Local migration files | 276 |
| Remote `schema_migrations` rows | 254 |
| Versions local-only | **80** |
| Versions remote-only | **58** |

Those two sets are largely **the same migrations under different version
numbers**. Local files use round stamps (`20260814120000`); the remote row
carries the real clock time from when it was applied by hand
(`20260814164621`). Three local prefixes also collide outright:
`20260319120000`, `20260325110000` and `20260412120000` each name two different
files.

A `db push` in that state would try to re-run roughly eighty migrations that are
already applied, many of which are not idempotent — `CREATE TABLE` without
`IF NOT EXISTS`, seed inserts, backfills that are not null-guarded. That is a
production-data hazard, not an inconvenience.

### The drift is self-perpetuating

Applying a migration through the dashboard or the MCP `apply_migration` tool
stamps it with **the time it ran**, not the timestamp in its filename. So every
hand-applied migration widens the gap by one more row.

### Applying one, today

1. Write the migration file under `supabase/migrations/` as normal.
2. Apply it by hand (MCP `apply_migration`, or the SQL editor).
3. Verify it against production before merging — the merge does not apply it.
4. Note in the PR that it is already applied, so nobody applies it twice.

### Reconciling it properly (not yet done)

This is a known, bounded piece of work rather than a mystery:

1. Pair each local-only version with its remote-only twin and confirm the two
   are the same migration (compare the SQL, not just the name).
2. `supabase migration repair --status applied <version>` for each already-applied
   local version, so the remote history matches the local filenames.
3. Rename or merge the three colliding prefixes.
4. Confirm `supabase migration list` shows local and remote in step.
5. Only then consider adding a `db push` step to the workflow.

Until step 4 passes, migrations stay manual.
