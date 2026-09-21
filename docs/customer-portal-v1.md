# Customer Portal V1 Product & Security Spec

## Purpose
Customer Portal V1 provides authenticated customers with a minimal, secure self-service view of their own jobs and account details.

## V1 Pages and Allowed Data Fields

### 1) Login
**Purpose:** Authenticate a customer, or create their account if they do not have one.

> **Updated 2026-09-21.** The password design below was specified for V1 and never
> shipped. The portal has no customer passwords at all. Sign-in is an emailed link plus a
> 6-digit code, Google, or a passkey; the emailed link doubles as sign-up. See
> `PORTAL_SIGN_IN.md` for the current design.

**Allowed fields shown/collected:**
- Email address
- 6-digit code from the sign-in email
- Generic authentication error message (no user-enumeration details)

**Explicitly excluded:**
- Any job, financial, or profile data before authentication
- Internal user IDs or system diagnostics
- Any indication of whether the address entered already has an account

### 2) Dashboard
**Purpose:** High-level summary of the customer's account and jobs.

**Allowed fields shown:**
- Customer display name
- Account status (active/inactive)
- Count of open jobs
- Count of completed jobs
- Recent jobs list (limited preview):
  - Job ID (external/public format only)
  - Job title or service type
  - Job status
  - Scheduled date/time

**Explicitly excluded:**
- Internal notes
- Margin, cost, profit, commission, or other internal financial fields
- Staff-only workflow metadata

### 3) Job History
**Purpose:** List all customer-visible jobs for the authenticated user.

**Allowed fields shown:**
- Job ID (external/public format only)
- Job title or service type
- Property/address summary (customer-safe)
- Job status
- Created date
- Scheduled date
- Completed date (if applicable)

**Explicitly excluded:**
- Internal notes and private staff comments
- Internal estimates, vendor costs, margin, or profit fields
- Internal assignment/routing notes

### 4) Job Detail
**Purpose:** Detailed customer-facing view of a single authorized job.

**Allowed fields shown:**
- Job ID (external/public format only)
- Job title/service type
- Customer-visible description/scope
- Status and milestone timestamps
- Service location (customer-safe)
- Customer-visible attachments/documents
- Customer-visible timeline/events

**Explicitly excluded:**
- Internal notes, QA notes, or escalation comments
- Margin/profit/cost breakdowns and internal billing calculations
- Internal-only documents and operational metadata

### 5) Profile
**Purpose:** Let user view/update their own contact details.

**Allowed fields shown/edited:**
- First name
- Last name
- Email
- Phone
- Password change controls
- Notification preferences (if enabled)

**Explicitly excluded:**
- Role/permission admin fields
- System flags and internal account risk scoring
- Other users' profile data

### 6) Support Contact
**Purpose:** Provide a secure channel for customer support requests.

**Allowed fields shown/collected:**
- Support email and/or support phone
- Contact form fields:
  - Subject
  - Message body
  - Optional related Job ID (validated for ownership)

**Explicitly excluded:**
- Direct exposure of internal team emails beyond designated support alias
- Internal ticketing metadata/status not intended for customers

## Access Control Rule (Mandatory)
Users may only access records where record ownership maps to their authenticated identity.

**Enforcement requirements:**
- Every data read/write endpoint must enforce ownership checks server-side.
- Client-side filtering alone is insufficient.
- Direct URL access to another customer's job/profile must return unauthorized/not found.
- Related resources (attachments, timeline events, support-linked jobs) must inherit the same ownership constraint.

## Session & Account Security Behavior

### Session timeout
- Inactivity timeout: 30 minutes.
- Absolute session lifetime: 12 hours max, then re-authentication required.

### Logout behavior
- Manual logout immediately invalidates the active session token.
- Logout from one device does not automatically revoke all devices unless "log out all sessions" is triggered.
- Browser back-button after logout must not restore authenticated data (no-cache headers on protected pages).

### Account recovery path
There is nothing to recover: no customer password exists. Requesting a fresh sign-in link
is the recovery path, and it is the same flow as signing in.

- Sign-in links are single-use and time-limited (15 minutes).
- Responses are generic to prevent account enumeration — the same card is shown whether or
  not the address has an account.
- A link is only usable in the browser that requested it (PKCE). The 6-digit code in the
  same email is the cross-device path.

## Definition of Done (V1)
- [ ] All six V1 pages implemented: Login, Dashboard, Job History, Job Detail, Profile, Support Contact.
- [ ] Each page exposes only explicitly allowed fields listed in this spec.
- [ ] Internal notes and margin/profit/cost fields are not present in API responses or UI payloads.
- [ ] Ownership checks are enforced server-side on every protected record access.
- [ ] Unauthorized cross-account record fetch by ID/URL returns unauthorized/not found.
- [ ] Session inactivity timeout and absolute timeout implemented and verified.
- [ ] Logout invalidates session and prevents viewing protected data via browser navigation cache.
- [ ] Password recovery flow uses expiring, single-use tokens and generic responses.
- [ ] Audit logging captures authentication events and authorization failures.
- [ ] Security test cases added and passing, including explicit cross-account access attempts that must fail.
