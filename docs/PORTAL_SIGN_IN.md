# Customer portal sign-in

There are three ways into the customer portal, and one way for staff to invite
someone in. Only one of them can create an account from nothing.

| Method | Creates an account? | Works cross-device? | Testable off production? |
| --- | --- | --- | --- |
| Email sign-in link | **Yes** | **Yes** (token-hash link, or the 6-digit code) | Yes |
| Google | Yes | n/a (same tab) | Yes |
| Passkey | **No** | n/a (same device) | No |
| Admin invite | Yes | **Yes** | Yes |

Passkeys cannot bootstrap an account — see `PASSKEYS.md`. Before email sign-in
existed, that left Google as the only route in, so a customer on an Outlook,
Yahoo or work address had no way to reach the portal at all.

---

## Before anything works: enable it on the Supabase project

None of this functions until Auth is configured. This is dashboard state, not
something a migration can set — there is no `supabase/config.toml` in this repo.

Open `https://supabase.com/dashboard/project/nlqzjzxkqteihffptkah`.

### 1. Authentication → Sign In / Providers → Email

- **Enable Email provider** — on.
- **Allow new users to sign up** — **on**. This is the one most likely to be
  wrong. With it off, `shouldCreateUser: true` fails with `signup_disabled` for
  every address that does not already have an account, so sign-in keeps working
  for existing customers and sign-up silently does not. The login page names
  this case specifically rather than showing the generic card.
- **Email OTP Expiration** — 900 seconds. Supabase's own security advisor flags
  anything above 3600.

### 2. Authentication → Emails → SMTP Settings → Enable Custom SMTP

The built-in email service is rate-limited to a couple of messages an hour
across the whole project and is documented as development-only. Resend already
has `boxed2built.com` verified, so point Auth at it:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS) or `587` |
| Username | `resend` |
| Password | a Resend API key |
| Sender email | `team@boxed2built.com` |
| Sender name | `Boxed2Built` |

Use a **separate** Resend API key from the `RESEND_API_KEY` the edge functions
use, so either can be rotated without taking down the other.

### 3. Authentication → Rate Limits

Raise **"Rate limit for sending emails"** from its default once custom SMTP is
on — it cannot be edited before that. Check the current number in the dashboard
rather than trusting any written here; it has changed over time.

### 3b. Authentication → Emails → SMTP Settings → **Minimum interval per user**

**Set this to 60 seconds.** It is the per-address cooldown: request a link for
an address inside the window and Supabase answers HTTP 429 with *"For security
purposes, you can only request this after N seconds."*

This is the throttle that stops the login form being used to flood a stranger's
inbox. Anyone can type any address into it — that is the nature of a sign-in
form — so the only thing standing between it and a mail-bomb is this number. At
1 second there is effectively no limit, and the damage lands on this domain's
sending reputation, not the attacker's.

The login page's own 60-second countdown is **not** a substitute. It constrains
someone using the page; it does nothing about a script calling the API directly.
It does read the server's number out of the 429 message and count down from
that, rather than assuming 60, so raising or lowering this stays in sync with
what customers see.

### 4. Authentication → Emails → Templates → Magic Link

Two things the template **must** contain, and one it must **not**:

- The link built from **`{{ .RedirectTo }}` + `{{ .TokenHash }}`**, as below.
- `{{ .Token }}` — the 6-digit code, displayed prominently.
- **Not `{{ .ConfirmationURL }}`.** That is the default, and it is the one thing
  that reintroduces the same-browser problem. See the next section.

`{{ .RedirectTo }}` is the `emailRedirectTo` that `sendMagicLinkForPortal`
passed, so it already carries `?flow=magic_link&next=…`. Appending the token
hash to it is what preserves the customer's destination through the email.

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

A full template, branded to match the other transactional mail (`#1e3a5f`
header, `#2563eb` CTA), is in `docs/templates/magic-link-email.html`. Paste it
into the dashboard whole.

This template is dashboard state and cannot be version-controlled, which is why
that copy exists — update both together.

**Do not turn on click tracking in Resend.** Any link-tracking rewrite replaces
the URL and the token never reaches us. It is currently off for
`boxed2built.com`; leave it that way.

### 5. Authentication → URL Configuration

- **Site URL**: `https://www.boxed2built.com`
- **Redirect URLs** must include:
  - `https://www.boxed2built.com/portal/callback**`
  - `https://boxed2built.com/portal/callback**`
  - `http://127.0.0.1:5173/portal/callback**` (local testing)
  - your deploy-preview pattern, if you want previews to work

The **double** asterisk matters. Supabase's globs treat `/` as a separator, so
a single `*` will not match a `redirect_to` carrying `?next=/portal/jobs`. A
`redirect_to` that matches nothing does not error — it silently falls back to
Site URL, which presents as "the link did nothing".

### 6. One-time Vault secret for the welcome-email cron

The hourly job that drains `portal_welcome_email_queue` authenticates with the
service role key, read from Vault at run time so it is never committed. Create
it once in the SQL editor:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key');
```

Until that exists the job runs and the function answers 401, which shows up in
`cron.job_run_details`.

---

## Why the template must not use `{{ .ConfirmationURL }}`

The Supabase client runs `flowType: 'pkce'` (`src/lib/supabase.ts`). Under PKCE,
`{{ .ConfirmationURL }}` produces a `?code=…` link that can only be exchanged by
the browser holding the code verifier in its localStorage.

So with the default template: **request the link on a laptop, open the email on
a phone, and the link cannot work.** Not slowly, not with a warning — the
exchange fails outright. Since reading mail on a phone is completely normal,
that is the single most common way this feature disappoints someone.

A **token hash** has no such constraint. It is verified server-side against a
hash Supabase already holds, so there is nothing local it depends on.
`CallbackPage` reads `token_hash` and `type` off the URL and calls
`verifyOtp({ token_hash, type })` — which is why the link now works wherever the
customer happens to read their mail.

It also survives link scanners. Outlook Safe Links and similar prefetch URLs in
email; a `{{ .ConfirmationURL }}` is a GET straight at Supabase's verify
endpoint, so prefetching **burns the token** and the human gets *"Token has
expired or is invalid"*. A token hash sitting on our own page is only spent by
the POST that `verifyOtp` makes, which a scanner fetching the HTML never runs.

The 6-digit code stays for the cases neither of those covers — a link mangled in
transit, a mail client that strips anchors, or someone who would simply rather
type six digits than hunt for a button.

Admin invites take a third route: `generateLink` registers no PKCE challenge, so
those links work in any browser without the template change. That is why the
invite function uses it rather than `signInWithOtp`.

---

## Anti-enumeration

The form must never reveal whether an address has an account, or it becomes a
free way to test who this business works with.

- `shouldCreateUser: true` makes Supabase answer known and unknown addresses
  identically. With `false` it answers unknown addresses with `otp_disabled`,
  which is exactly the oracle to avoid.
- The page shows the same "check your email" card on success *and* on failure,
  with identical copy and markup. `tests/portal-login.spec.ts` asserts the two
  renders are byte-identical.
- Two exemptions, neither of which says anything about a particular address:
  project-wide misconfiguration (`signup_disabled`, `email_provider_disabled`,
  `otp_disabled`) and a malformed address. Those are surfaced, because hiding
  them just leaves someone waiting for mail that is never coming.
- `user_banned` is deliberately **not** exempt — it is per-account and would
  leak.

---

## Admin invite

**Admin → Clients → Invite**, on any client with an email address.

Sends a branded Resend email carrying a link minted by
`auth.admin.generateLink()` with the service role. Because that link is
implicit-flow, the customer can open it on any device. Their existing jobs,
invoices and documents are already linked, because `auto_create_portal_customer`
binds the auth user to the `customers` row matching their address.

- 24-hour server-side cooldown per client. The client-side copy of it is a
  courtesy; the function is the control.
- Writes `clients.last_portal_invite_sent_at` (cooldown, admin badge) and
  `customers.invited_at` (adoption reports). Both, because they answer
  different questions and `customers` may not have a row yet at invite time.
- The confirm dialog shows the destination address. One misdirected invite is
  one customer seeing another customer's email.

---

## Welcome sequence

Three emails — immediately, +2 days, +5 days — queued into
`portal_welcome_email_queue` by `enqueue_portal_welcome_sequence_for_customer`
and drained hourly by `send-portal-welcome-emails`.

Customers who have turned email off or unsubscribed are marked `skipped` rather
than mailed. A send failure is marked `failed` rather than left `pending`, so
one bad address cannot have the batch retry it forever. A `template_key` with
no copy in the function is left `pending` on purpose: that means the SQL grew a
step the sender does not know about, and a queue that visibly stops draining
beats guessing at what to say.

---

## How it is wired

| Concern | Location |
| --- | --- |
| Send a link / verify a code | `src/contexts/AuthContext.tsx` (`sendMagicLinkForPortal` / `verifyPortalEmailOtp`) |
| Login page UI and cooldown | `src/pages/portal/LoginPage.tsx` |
| Error copy (pure, unit-tested) | `src/utils/magicLinkErrors.ts` |
| Post-login destination (pure, unit-tested) | `src/utils/portalNextPath.ts` |
| Landing, token-hash redemption, telling a magic link from OAuth | `src/pages/portal/CallbackPage.tsx` |
| Account provisioning | `auto_create_portal_customer` (SQL), via `portalPostLoginService` |
| Admin invite | `supabase/functions/send-portal-invite-email/` + `clientService.sendPortalInvite` |
| Welcome drip | `supabase/functions/send-portal-welcome-emails/` + hourly `cron.schedule` |

Two details worth knowing before changing any of it:

- **`next` rides in the redirect URL, not sessionStorage.** sessionStorage is
  per-tab and a mail client always opens a new tab, so the stored value is
  guaranteed missing on a magic-link landing. Google still uses storage because
  it redirects the same tab. `resolveNextPath` prefers the URL and falls back.
- **The audit branch for `magic_link` must precede the `provider === 'google'`
  branch** in the `SIGNED_IN` handler. `app_metadata.provider` reports the
  provider the account was *created* with and never changes, so a customer who
  signed up with Google and later used a link would otherwise be logged as a
  Google sign-in. Same trap the passkey path documents.

---

## Testing

`tests/unit/magicLinkErrors.test.ts` and `tests/unit/portalNextPath.test.ts`
cover the pure helpers — every error code maps to actionable copy, the server's
cooldown number is parsed correctly, and only genuine portal paths survive
`getSafeNextPath`.

`tests/portal-login.spec.ts` drives the shipped page against stubbed auth
responses via `tests/harness/portal-login.tsx`. It covers the form→sent
transition, the byte-identical render for known and unknown addresses, the
resend countdown, that an invalid address never reaches the network, the
`?email=` prefill, and the wrong-browser error copy.

```
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome \
VITE_SUPABASE_URL=https://stub.supabase.co \
VITE_SUPABASE_ANON_KEY=<any well-formed JWT> \
npx playwright test portal-login
```

The stub sends `x-supabase-api-version: 2024-01-01` deliberately: auth-js only
reads `code` off the body when the response declares that version, so without
the header the errors arrive with no code and the test exercises a path
production never takes.

**What no automated test covers, and why:** real delivery, the Supabase verify
endpoint, the PKCE exchange, the callback landing, and `generateLink`. All of
them need a real Auth project and a real mailbox; stubbing them would only
assert that the stubs match what the tests already assume. Verify those by hand:

1. Request a link with an address that has never been used. The sent card
   appears.
2. The email arrives with **both** a link and a 6-digit code.
3. Open the link in the same browser → lands on `/portal/dashboard`.
4. A `customers` row exists with `source='portal_self_registration'`, and a
   `clients` row as a `lead`.
5. `portal_funnel_events` has both a `login` and an `account_created` row.
6. `portal_welcome_email_queue` has 3 rows for that customer; the first flips to
   `sent` on the next hourly tick.
7. `/portal/login?next=/portal/invoices` → sign in by link → land on invoices,
   not the dashboard.
8. Request a link on a laptop and open it **on a phone**. With the token-hash
   template it must sign in there. If it instead fails with the *different
   browser* copy, the template is still on `{{ .ConfirmationURL }}` — fix step 4.
   Then check the 6-digit code path too: request a fresh link and type the code
   on the laptop.
9. Invite a client with existing jobs from Admin → Clients. Open that email on a
   different device — it must sign in. Their jobs are already visible.
   `/admin/portal-adoption` shows them as `invite_sent`. A second invite
   immediately returns the 24-hour cooldown.
10. Google and passkey sign-in both still work. Passkeys must be checked on live
    `boxed2built.com` — they cannot work on a preview.

Unlike passkeys, email sign-in **does** work on localhost and deploy previews,
once the callback URL is in the redirect allowlist. It is the first portal auth
method that can be exercised end-to-end off production.
