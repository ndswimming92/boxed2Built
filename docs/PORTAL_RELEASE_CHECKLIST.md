# Portal Release Checklist

Use this checklist before rolling out portal access in production.

## 1) Regression test existing admin authentication and pages

- [ ] Verify admin sign-in flow (valid login, invalid credentials, password reset, logout).
- [ ] Confirm admin route guards still enforce authentication and redirect correctly.
- [ ] Smoke test all core admin pages for render/load errors and broken navigation.
- [ ] Validate key admin actions (create/edit records, status updates, exports) still succeed.
- [ ] Confirm audit logging and analytics events still fire for admin auth/page actions.

## 2) Portal access-control tests (A/B account isolation)

- [ ] Create or identify two separate portal accounts (Account A and Account B) with distinct data.
- [ ] Verify Account A can view only Account A resources (dashboard, jobs, profile).
- [ ] Verify Account B can view only Account B resources.
- [ ] Attempt direct URL access to another account's job/resource IDs and confirm access is denied.
- [ ] Validate API/service-layer enforcement (not only UI filtering) for cross-account requests.
- [ ] Confirm session expiration and re-auth behavior does not leak data between accounts.

## 3) Migration validation in staging (production-like data subset)

- [ ] Run pending schema/policy migrations in staging using a sanitized production-like dataset.
- [ ] Verify migration completes cleanly (no failed statements, no partial rollback states).
- [ ] Run post-migration integrity checks (row counts, FK consistency, nullability assumptions).
- [ ] Validate portal/admin critical queries still perform within acceptable thresholds.
- [ ] Execute end-to-end smoke tests after migration to confirm app-level compatibility.

## 4) Feature flag portal and navigation link for gradual rollout

- [ ] Add/verify a feature flag for enabling portal routes.
- [ ] Add/verify a separate feature flag for showing the portal navigation/login link.
- [ ] Confirm flags can be toggled independently without redeploy.
- [ ] Validate behavior for all states: both off, route on/nav off, both on.
- [ ] Define phased rollout cohorts and monitoring checkpoints.

## 5) Prepare rollback steps (schema, policies, frontend routes)

- [ ] Document exact rollback order (frontend first/last, policy rollback, schema rollback).
- [ ] Prepare reversible SQL scripts for policy and schema changes where possible.
- [ ] Define fallback behavior when schema rollback is not fully reversible.
- [ ] Provide a safe frontend kill switch (disable routes/nav via feature flags).
- [ ] Include post-rollback verification checks for admin auth/pages and portal isolation.
- [ ] Record communication/escalation owners and rollback decision criteria.

## Release Sign-off

- [ ] Engineering sign-off
- [ ] QA sign-off
- [ ] Product/Operations sign-off
- [ ] Rollout window and on-call coverage confirmed
