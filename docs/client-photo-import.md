# Adding Clients (Manual + Photo Import)

How a client record gets created from the admin portal — by typing the details
in, or by photographing them and letting Claude read the fields off the picture.

Both paths end in the same editable form, and nothing is saved until you press
**Create Client**. The photo scan is a shortcut for typing, never a substitute
for reviewing what gets stored.

## Flow summary

1. Open **Admin → Clients** and click **Add Client**. The same form opens from
   **Add a new client** in the client search on any job — see
   [Picking a Client on a Job](./job-client-picker.md).
2. Optionally drop a photo into **Fill from a photo** — a business card, a
   handwritten note, a work order, a printed invoice, or a screenshot of a text
   or email — and click **Scan Photo**.
3. The browser downscales the image to 1568px on its long edge and posts it to
   the `analyze-client-photo` edge function, which sends it to Claude and gets
   back the contact fields it could read.
4. Fields the photo answered are filled in below. Anything you already typed is
   left alone, so scanning never overwrites your own edits.
5. A banner lists which fields were filled, how legible the photo was, and any
   warnings ("last digit was smudged", "two names on the card").
6. Correct anything that looks wrong, fill in the rest, and click
   **Create Client**.

## The form

| Field | Notes |
| --- | --- |
| Full Name | Required. A person's name or a business name. |
| Email / Phone | At least one is required — the `clients` table enforces it. Phone is reformatted to `(615) 555-1234` when it is a valid US number. |
| Address | Free text, one line. |
| Status | `lead` (default), `active`, `repeat`, `dormant`. |
| Value Tier | `standard` (default), `high_value`, `vip`. Recalculated from revenue by **Refresh Metrics**. |
| Source | Free text with the standard referral sources as suggestions. |
| Tags | Comma separated. |
| Internal Note | Optional. Saved as the first row in `client_notes`, never shown to the client. |
| Marketing opt-in | On by default, matching the table default. |
| Test record | Sets `is_test`, which keeps the row out of segment stats and marketing lists. |

New records get `first_contact_date` and `last_contact_date` set to now, so a
new client lands at the top of the default (last contact) sort. The referral
code is assigned by the `trg_assign_referral_code` trigger, and the preferences
token comes from `generate_preferences_token()` so the client's self-service
preferences link works the same as for records created from an inquiry.

If the email already belongs to another client the save is rejected by the
unique index and the form says so — use **Merge** on the Clients page to combine
duplicates rather than creating a second record.

## Edge function: `analyze-client-photo`

Same shape as `analyze-gallery-image`:

- **Auth** — the caller's JWT must resolve to a real user whose
  `app_metadata.is_platform_admin` is true. The published anon key alone is not
  enough, because every call spends money.
- **Request** — `{ image: <base64>, mediaType: "image/png" | ..., hint?: string }`.
  `hint` is the optional "Anything to add?" box; it steers interpretation but
  never substitutes for what is actually written in the photo.
- **Response** — `{ name, email, phone, address, source, notes, confidence,
  warnings }`. Every field except `confidence` and `warnings` can be `null`; the
  prompt tells the model to return `null` rather than guess at anything it can't
  read.
- **Model** — `claude-opus-5` at low effort, with the response shape pinned by a
  JSON schema (`output_config.format`). If the API rejects the structured-output
  field, the function retries once without it and parses the JSON out of the
  reply, so the scan still works.

### Secrets

The function reads `Claude_Client_Photo_Import`, and falls back to
`Claude_Gallery_Image_Creation` when that is not set — so it works out of the
box on a project that already has the gallery key. Set a dedicated key if you
want the two features billed or rotated separately:

```bash
supabase secrets set Claude_Client_Photo_Import=sk-ant-...
```

### Deploy

```bash
supabase functions deploy analyze-client-photo
```

## Failure modes

- **Nothing readable in the photo** — the scan reports that no contact details
  were found and asks for a clearer shot. The form stays as it was.
- **Photo scan failed (5xx)** — the Anthropic call failed. Details are in the
  function logs; the admin can still type the details in.
- **API key not configured** — neither secret is set on the project.
- **Forbidden** — the signed-in user is not a platform admin.

None of these block client creation. Every field the scan fills is an ordinary
form field, so the manual path is always available.

## Opening the form from a job

The client search at the top of every job form offers **Add a new client**, which
opens this same form — photo scan included — over the job. What is already known
is carried in so it isn't typed twice, and creating the client links the job to
it. [Picking a Client on a Job](./job-client-picker.md) covers that side.
