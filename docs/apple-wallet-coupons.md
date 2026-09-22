# Apple Wallet coupon passes

A customer can add a Boxed2Built coupon to Apple Wallet. The pass shows the discount, the code,
a QR that opens the prefilled quote form, and the last day the code works.

> **This feature does nothing until an Apple Developer Program membership exists.**
> Without the certificates below, `generate-coupon-pass` returns 503 and the Add to Wallet button
> never appears. Nothing else breaks.

## The certificate is the whole job

**Apple Business Manager cannot do this.** `business.apple.com` manages devices, users and app
licences. Signing a `.pkpass` needs a Pass Type ID certificate, and only the **Apple Developer
Program** (`developer.apple.com`, **$99/year**) issues those.

### One-time setup

1. Join the Apple Developer Program.
2. Certificates, Identifiers & Profiles → Identifiers → **Pass Type IDs** → create
   `pass.com.boxed2built.coupon`.
3. Generate its signing certificate and export the certificate and private key as PEM.
4. Download the **Apple WWDR** intermediate certificate and convert it to PEM.
5. Set these as Supabase edge function secrets:

   | Secret | What it is |
   |---|---|
   | `APPLE_PASS_TYPE_ID` | `pass.com.boxed2built.coupon` |
   | `APPLE_TEAM_ID` | Your 10-character Apple team id |
   | `APPLE_PASS_CERT_PEM` | Pass Type ID certificate, PEM |
   | `APPLE_PASS_KEY_PEM` | Its private key, PEM |
   | `APPLE_PASS_KEY_PASSPHRASE` | Only if the key is encrypted |
   | `APPLE_WWDR_PEM` | Apple WWDR intermediate, PEM |

### ⚠️ Renewal

**The Pass Type ID certificate expires after one year.** When it lapses, pass generation stops and
nothing announces it — the button simply returns an error. Put the expiry date in a calendar now.
Apple also rotates the WWDR intermediate periodically, and a lapsed $99 membership revokes the
certificate outright.

## How a customer gets one

No new page was needed. The promo pipeline already posts `couponShareUrl()` —
`https://boxed2built.com/contact?coupon=CODE` — to Facebook, `ContactForm` already prefills and
validates the code from that URL, and the **Add to Apple Wallet** button now sits under the
"code applied" confirmation there.

So: Facebook post → prefilled quote form → Add to Apple Wallet. The existing share link, reminder
email and Share button all lead to it without modification.

The button renders only on iPhone, iPad, or macOS Safari. Android and desktop Chrome get nothing
rather than a file their device cannot open. Admins get an always-visible **Wallet pass** button on
`/admin/coupons` so the pass can be checked from any machine.

## How it is built

| File | Role |
|---|---|
| `supabase/functions/_shared/pkpass.ts` | manifest, PKCS#7 signature, zip |
| `supabase/functions/_shared/couponPass.ts` | the `pass.json` content — pure, unit-tested |
| `supabase/functions/_shared/pass-assets/index.ts` | generated artwork, base64 |
| `supabase/functions/generate-coupon-pass/index.ts` | the public endpoint |
| `src/components/AddToWalletButton.tsx` | the customer and admin buttons |
| `tests/unit/couponPass.test.ts` | pass content, including the expiry trap below |

A `.pkpass` is a flat zip of `pass.json`, artwork, a `manifest.json` of **SHA-1** digests, and a
**detached PKCS#7** signature over that manifest. Every one of those is load-bearing: iOS accepts
or silently refuses the whole file, with no error shown on the device.

`passkit-generator` is deliberately not used. Its Deno compatibility is unverified, and both parts
it provides already exist here — `fflate` (which already builds 3MF zips in
`src/lib/threemf/write.ts`) and `node-forge`, the PKCS#7 implementation that library itself wraps.

### Two traps worth knowing

**`ends_at` is exclusive.** It stores the midnight *after* the last valid day. `expirationDate`
uses that raw instant, because it is genuinely the moment the code stops working — but any text a
human reads must show the day before, via `describeValidThrough()`. A coupon ending
`2026-10-01T05:00Z` is advertised as "valid through Wednesday, September 30". There is a unit test
pinning this.

**`relevantDate` was deprecated in iOS 18.** Current devices read `relevantDates`, an array of
`{ startDate, endDate }`. Most tutorials still show the singular key, which is silently ignored.
The pass opens a window `RELEVANT_DAYS_BEFORE_EXPIRY` (3 days) before expiry, clamped so a coupon
expiring sooner than that still gets a valid range.

## Abuse protection

The endpoint is public — the whole point is that a Facebook link opens straight into Wallet — so it
leans on `lookup_coupon_by_code`, the same definer function the contact form uses. That is
IP-throttled at 20 lookups per 15 minutes and returns only coupons that are active and in-window,
so this endpoint cannot enumerate codes or resurrect an expired one. It is called with the **anon**
key and the caller's `x-forwarded-for`, so the limit stays per-client rather than lumping every
visitor into one bucket. A missing or expired code returns 404 either way, so the response never
confirms which codes exist.

## Verifying a change

```bash
npm run test:unit          # includes tests/unit/couponPass.test.ts
npm run typecheck
```

To check the signing pipeline without Apple certificates, generate a throwaway pair and verify the
detached signature — the structure is identical, only the trust chain differs:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 2 -nodes \
  -subj "/CN=Pass Type ID: pass.com.boxed2built.coupon/OU=TEAM/O=Test"
# build a pass, then:
openssl smime -verify -in signature -inform DER -content manifest.json -noverify
```

Expect `Verification successful`. Altering one byte of `manifest.json` must make it fail — if it
does not, the signature is not actually covering the content.

With real certificates, open the `.pkpass` on a **physical iPhone**; the Simulator does not add
passes. Confirm the discount wording matches the site, the QR opens the prefilled quote form, and
the deadline reads as the last usable day rather than the day after.

## Regenerating the artwork

```bash
npm install --no-save sharp
node scripts/generate-pass-assets.mjs
```

Same convention as `scripts/optimize-images.mjs`: `sharp` is a native binary and stays out of the
deploy. The artwork is inlined as base64 because an edge function cannot reliably read binary files
shipped beside it, and a pass missing `icon.png` is rejected with no error at all.

## Not built

Updating a pass after it is issued — marking it redeemed, changing a balance — needs
`webServiceURL`, device registration endpoints and APNs push. A coupon's terms never change after
issue, so none of that is here. If gift-card passes with live balances are ever wanted, that is the
point at which the web service becomes unavoidable, and it is a materially larger piece of work.
