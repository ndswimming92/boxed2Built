# Passkeys (WebAuthn)

Both the admin portal and the customer portal can be signed into with a passkey — a
credential held by your phone, laptop or password manager and unlocked with a fingerprint,
face or device PIN. Passkeys cannot be phished: the browser will only release one to the
real boxed2built.com, so a lookalike site gets nothing.

Passkeys are **additive**. Google sign-in, customer email sign-in links and the admin
email+password form all still work exactly as before, and they are the recovery path if
every enrolled device is lost.

See `PORTAL_SIGN_IN.md` for the customer side: what each method can do, and the one thing
passkeys cannot.

---

## Before anything works: enable it on the Supabase project

None of the UI functions until passkeys are switched on server-side. This is dashboard
state, not something a migration can set — there is no `supabase/config.toml` in this repo.

1. Open `https://supabase.com/dashboard/project/nlqzjzxkqteihffptkah`
2. **Authentication → Passkeys**
3. Turn on **Enable Passkey authentication**
4. Fill in the relying-party details exactly:

   | Field | Value |
   | --- | --- |
   | Relying Party Display Name | `Boxed2Built` |
   | Relying Party ID | `boxed2built.com` |
   | Relying Party Origins | `https://boxed2built.com,https://www.boxed2built.com` |

5. Save.

Until this is done, every passkey button reports *"Passkeys are not switched on for this
site yet."*

### ⚠️ The Relying Party ID is effectively permanent

Passkeys are cryptographically bound to the RP ID they were created against. **Changing
`boxed2built.com` later invalidates every passkey anyone has enrolled** and forces everyone
to start over. The bare apex domain is used deliberately: it covers both
`boxed2built.com` and `www.boxed2built.com`, and any subdomain added later.

---

## Passkeys do not work on localhost or deploy previews

The browser requires the page's origin to match, or be a subdomain of, the RP ID. Neither
`127.0.0.1:5173` nor `deploy-preview-*.netlify.app` is a subdomain of `boxed2built.com`, so
the ceremony is refused before any request is sent. The UI reports this as *"Passkeys only
work on the live boxed2built.com site, not on this address."*

This is expected, not a bug. Consequences:

- Passkey sign-in can only be exercised end-to-end **on the live site**.
- There is no automated browser test for the ceremony, by design — see *Testing* below.
- If you ever want a testable staging environment, give it a real subdomain
  (`staging.boxed2built.com`) and add its origin to Relying Party Origins. The limit is 5
  origins.

---

## Using it

### Enrolling (first time, per device)

A passkey can only be added to an account that is already signed in — there is no way to
create an account from a passkey alone. So the first sign-in on a new device is always
something else: for a customer, an emailed sign-in link or Google; for admin, Google or
email+password.

- **Admin:** sign in, then **System & Tools → Security → Add a passkey**
- **Customer:** sign in, then **My Profile → Passkeys → Add a passkey**

The name is filled in automatically from the authenticator ("iCloud Keychain", "Google
Password Manager", "1Password"), and can be renamed. Enroll one per device you actually
sign in from.

### Signing in

"Sign in with a passkey" on either login page. No email is typed: passkeys here are
*discoverable credentials*, so the device offers whichever accounts it holds and you pick
one.

Because of that, on a shared device the picker may offer an admin passkey on the customer
login page or vice versa. Both cases are handled — you are either routed to the right
portal or told the account has no access there.

### Losing a device

Remove the passkey from the Security / Profile screen and sign in the other way. Passkeys
never replace Google or the admin password, so there is no lockout scenario that requires
support intervention.

---

## How it is wired

| Concern | Location |
| --- | --- |
| Experimental opt-in on the client | `src/lib/supabase.ts` (`auth.experimental.passkey`) |
| All Supabase passkey calls | `src/services/passkeyService.ts` |
| Error copy (pure, unit-tested) | `src/utils/passkeyErrors.ts` |
| Sign-in + authorization + audit | `src/contexts/AuthContext.tsx` (`signInWithPasskeyForAdmin` / `ForPortal`) |
| Shared management UI | `src/components/auth/PasskeyManager.tsx` |
| Admin screen | `src/pages/admin/SecurityPage.tsx` (`/admin/security`) |
| Customer screen | `src/pages/portal/ProfilePage.tsx` |

Two details worth knowing before changing any of it:

- **Supabase still ships this API as experimental**, which is why every call goes through
  `passkeyService.ts`. If upstream changes shape, that is the file to fix.
- **`AuthContext` sets `user` only after an awaited organization fetch**, so context state
  lags the `signInWithPasskey()` promise. The portal login page therefore calls
  `runPortalPostLogin()` directly with the user it was handed, rather than routing through
  `/portal/callback` the way Google sign-in does. Routing there instead would read the
  not-yet-set user as a dead session and bounce to "session expired", silently skipping
  account linking and the adoption funnel event.

Passkey sign-ins are recorded in `admin_audit_logs` with `metadata.provider = 'passkey'`
and show up in **Activity Logs**. They cannot be identified from
`app_metadata.provider`, which reports the provider the account was *created* with and
never changes — hence the explicit marker in `AuthContext`.

---

## Testing

`tests/unit/passkeyErrors.test.ts` covers the error copy.

There is deliberately **no Playwright test for the ceremony**. Driving a CDP virtual
authenticator would mean stubbing an undocumented, explicitly-unstable wire format, and
would have to pin the RP ID to `127.0.0.1` — the opposite of production, so the single
thing most likely to break in prod is the one thing such a test could not catch. It would
assert that auth-js talks to itself correctly.

Verify on the live site instead, after any change to the passkey path:

1. Add a passkey → it appears with an auto-derived name.
2. Sign out → sign back in with it → land on the right dashboard.
3. Activity Logs shows the sign-in as a passkey login.
4. Rename and remove it; confirm a removed passkey no longer signs in.
5. Confirm Google (and admin password) still work.
