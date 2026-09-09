# Referral QR codes

Every client has a referral code (`B2B-ADRIA-4F7D`) assigned by the
`trg_assign_referral_code` database trigger. This feature turns that same code
into a scannable QR, so a client can hand someone a printed thank-you token
instead of reciting a code that nobody types in.

Scanning opens the quote form with the code already in the "Have a Referral or
Coupon Code?" box. Nothing needs to be provisioned per client: the code already
exists, so every current and future client has a working QR.

## The URL

```
QR encodes:  HTTPS://BOXED2BUILT.COM/R/B2B-ADRIA-4F7D
Copy button: https://boxed2built.com/r/B2B-ADRIA-4F7D
             → /contact?ref=B2B-ADRIA-4F7D
```

Both forms resolve to the same place. The copy button gives the normal-case one
because that is what gets texted to people.

### Why the QR payload is uppercase

Uppercase keeps the whole string inside QR **alphanumeric** mode. Mixed case
falls back to byte mode, which needs a bigger symbol for the same URL:

| Payload | Mode | Version | Modules |
|---|---|---|---|
| `https://boxed2built.com/r/B2B-ADRIA-4F7D` | byte | 5 | 37 × 37 |
| `HTTPS://BOXED2BUILT.COM/R/B2B-ADRIA-4F7D` | alphanumeric | 4 | 33 × 33 |

Fewer modules means chunkier squares at the same physical size — roughly
1.21 mm versus 1.08 mm per module on a 40 mm token. That margin matters on a
0.4 mm nozzle, and it costs nothing.

Two things make it safe, and **both are load-bearing**:

- React Router matches static path segments case-insensitively, so `/R/…` hits
  the `r/:code` route.
- Netlify matches `_redirects` paths **case-sensitively**, so `public/_redirects`
  lists `/R/*` as well as `/r/*`. Without that line the CDN answers a 404
  before the app ever loads. Browsers lowercase the host but leave the path
  alone, so `/R/` really does arrive uppercase.

## Rules for anything printed

Physical tokens cannot be corrected after the fact. Two constraints follow:

1. **`/r/` must keep working, forever.** Never delete or rename the route. It
   exists as an indirection layer precisely so the destination can change later
   without reprinting anything. Never point a QR straight at `/contact`.
2. **URLs are built from `SITE_URL`**, never `window.location.origin`. A code
   generated while running locally would otherwise encode `localhost:5173`.
   `getShortURL()` in `qrCodeService.ts` still uses the runtime origin — that is
   fine for a reprintable poster, but it is not the helper to copy here.

Before printing a batch, download one SVG and confirm the encoded URL reads
`HTTPS://BOXED2BUILT.COM/R/…`.

## Scan tracking

`/r/<code>` calls the `log_referral_scan` RPC before forwarding. Counts appear
on the client row and in the client detail panel.

- The RPC **returns void whether or not the code matched**. It must stay that
  way: a function that answered differently for a real code would be an
  enumeration oracle over the client list.
- Bot and link-preview traffic is logged but never counted. Pasting a referral
  link into iMessage, WhatsApp or Slack makes those services fetch the URL, and
  that is not somebody scanning a token.
- A repeat from the same user agent inside 60 seconds is ignored, which also
  absorbs a double render of the redirect page.
- Aggregates are cached on `clients.referral_scan_count` and
  `clients.referral_last_scanned_at` by trigger, so the client list needs no
  extra query. `referral_scans` holds the raw log.

## Who referred whom

`add_referral_credit_on_inquiry_insert` fires on every inquiry. When
`referral_code_used` matches a client it does two things:

- Adds $25 to that referrer's `referral_credit_balance`. This happens on
  **every** use of their code.
- Sets `referred_by_client_id` on the client who submitted the inquiry, but
  only if it is still null. **First referral wins** — a repeat customer's later
  inquiry cannot rewrite who originally introduced them, even though the code's
  owner is still paid for that use.

A **self-referral is not a referral**. Entering your own code used to pay out,
which made a client's own code worth $25 an inquiry; it now does nothing and
records nothing. Test submissions and codes matching no client are skipped, as
before.

`20260909130000_record_referral_graph_on_inquiry.sql` also backfills the graph
from inquiries already on file. It writes attribution only — historical credit
is deliberately not replayed, since those payouts already happened.

## Where the code lives

| Path | What it does |
|---|---|
| `src/services/referralQRService.ts` | URL builders, scan logging, session persistence |
| `src/pages/ReferralRedirectPage.tsx` | The `/r/:code` route |
| `src/lib/qrExport.ts` | Shared PNG/SVG/PDF rendering, used by marketing codes too |
| `src/components/admin/ClientQRCodeModal.tsx` | Preview and downloads |
| `src/components/ContactForm.tsx` | `?ref=` prefill and the welcome banner |
| `supabase/migrations/20260909120000_add_client_referral_qr_scans.sql` | Tables, trigger, RPC |
| `tests/referral-qr.spec.ts` | What a scanned token puts in the form, and that the printed URL is canonical |
| `tests/harness/referral-qr.{html,tsx}` | Mounts the modal outside the admin auth guard |

The referral code itself is unchanged — it is still generated, displayed and
redeemed exactly as before. The QR is only another way to deliver it.
