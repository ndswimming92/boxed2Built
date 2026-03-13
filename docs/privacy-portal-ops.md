# Privacy Portal Operations

This document defines legal/compliance handling for the privacy tooling in `/portal/privacy` and `/admin/privacy-requests`.

## Scope

The privacy portal supports:

1. **Download my data** requests (async export jobs).
2. **Account deletion** requests with grace period + explicit confirmation.
3. **Marketing consent management** for promotional email/SMS.
4. **Admin processing dashboard** and **immutable privacy audit trail**.

## Data Subject Rights Flow

## 1) Data Export (DSAR Access)

- Customer submits request in `/portal/privacy`.
- System creates:
  - `customer_privacy_requests` row (`request_type = data_export`)
  - `customer_privacy_export_jobs` row (`status = queued`)
- Admins process export in `/admin/privacy-requests`:
  - `queued -> processing -> ready|failed|expired`
- Customer downloads export from generated URL while valid.

Compliance notes:
- Record request receipt timestamp.
- Fulfill within required jurisdictional SLA.
- Keep audit proof for request lifecycle.

## 2) Account Deletion (Erasure)

- Customer submits deletion request with configurable grace period.
- System stores request as `pending_confirmation`, assigns confirmation token, and computes `grace_period_ends_at`.
- Customer confirms request using request ID + token.
- Status moves to `scheduled`.
- Admin workflow:
  - `scheduled -> processing -> completed|rejected|cancelled`
- Completion is blocked before grace period end.

Compliance notes:
- Grace period provides rescission window and anti-abuse control.
- Use admin notes for legal hold / exceptions.
- If deletion is rejected or delayed, store reason in request metadata/notes.

## 3) Marketing Consent

- Customer controls email and SMS marketing independently.
- Consent updates are stored in `customer_marketing_consents` with source and timestamps.
- Consent and revocation are auditable via privacy events.

Compliance notes:
- Enforce channel-specific consent at campaign send time.
- Respect revocation immediately.
- Preserve consent records as lawful basis evidence.

## Immutable Audit Requirements

`privacy_audit_events` is append-only:
- `UPDATE` and `DELETE` blocked by trigger.
- Inserts occur through privacy workflow functions.

Events include actor type, subject table/id, and event metadata for legal traceability.

## Admin SOP

In `/admin/privacy-requests`:

1. Triage new export jobs daily.
2. Process confirmed deletion requests after grace period.
3. Review failures and add remediation notes.
4. Verify consent changes for disputed marketing contacts.
5. Use audit timeline as source of truth during compliance review.

## Incident / Litigation Hold Guidance

If legal hold applies:
- Do **not** finalize deletion.
- Set deletion request status to `rejected` or hold via processing notes.
- Record hold reason in `admin_notes` and privacy audit details.

## Retention Recommendations

- Keep privacy request and audit metadata for statutory period.
- Expire export URLs and rotate secure storage keys.
- Avoid storing plaintext exports beyond operational necessity.

## Security and Access Model

- Portal users can only read their own request/job/consent records via `current_customer_id()`.
- Admin actions require `can_manage_org_settings(organization_id)` checks.
- Audit log read is scoped to own customer records or organization visibility.

## Operational Checklist

- [ ] Daily export queue review.
- [ ] Daily deletion queue review (especially grace-period-complete records).
- [ ] Weekly audit trail integrity spot-check.
- [ ] Monthly consent revocation enforcement test.
- [ ] Quarterly DSAR SLA evidence export.
