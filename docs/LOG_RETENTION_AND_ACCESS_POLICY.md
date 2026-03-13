# Log Retention and Access Policy

## Scope
This policy applies to application audit and security monitoring events stored in `admin_audit_logs`, including:

- Authentication events (`LOGIN`, `LOGOUT`)
- Sensitive reads (`VIEW`, `DOWNLOAD`)
- Data exports (`EXPORT`)
- Security warnings and errors

## Retention
- **Hot retention:** 90 days in primary operational storage for day-to-day investigations.
- **Extended retention:** 365 days in archived storage for compliance and forensic review.
- **Deletion window:** Logs older than 365 days should be purged via scheduled maintenance.

## Access Control
- Audit logs are restricted by row-level security to authenticated organization members and platform admins.
- Only platform admins can grant or revoke access to log review workflows.
- Raw logs must not be shared outside approved admin channels.

## Monitoring and Alerting
The admin activity log workflow should monitor and alert on:

1. Repeated failed login attempts (>=5 in a 24-hour window)
2. Abnormal sensitive access patterns (>=30 sensitive reads/exports by one user in 24 hours)

## Operational Requirements
- Correlation IDs are attached to Supabase requests and audit metadata for traceability.
- Exported logs are considered sensitive and must be stored in controlled systems only.
- Incident responders should include correlation IDs in investigation notes.

## Review Cadence
- Security and operations teams should review this policy quarterly.
- Retention thresholds and alert baselines should be tuned based on observed usage patterns.
