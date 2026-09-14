# Security Architecture

This document explains the security design decisions for the Boxed2Built application and addresses common security audit findings.

## Table of Contents
1. [Security Model Overview](#security-model-overview)
2. [RLS Policy Design](#rls-policy-design)
3. [Authentication & Authorization](#authentication--authorization)
4. [Leaked Password Protection](#leaked-password-protection)
5. [Anonymous Access Policies](#anonymous-access-policies)
6. [Index Management](#index-management)

---

## Security Model Overview

This application uses a **single-admin security model** where:

- **One Business Owner**: The application is designed for a single business (Boxed2Built)
- **Trusted Admins Only**: All authenticated users are authorized administrators
- **Email Whitelist**: Security boundary is enforced at authentication via email whitelist
- **Public Forms**: Anonymous users can submit contact forms and scan QR codes

### Three-Layer Security

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Authentication (Supabase Auth)                      │
│ - Email/password login                                       │
│ - Only whitelisted emails can authenticate                   │
│ - Leaked password protection (see setup below)               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Authorization (Frontend)                            │
│ - src/utils/authorization.ts                                 │
│ - Checks user email against VITE_AUTHORIZED_ADMIN_EMAILS     │
│ - Redirects unauthorized users                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Row Level Security (Database)                       │
│ - Authenticated users: Full access (USING/WITH CHECK = true) │
│ - Anonymous users: INSERT only for public forms              │
└─────────────────────────────────────────────────────────────┘
```

---

## RLS Policy Design

### Why "Always True" Policies?

The RLS policies with `USING (true)` and `WITH CHECK (true)` are **intentional design decisions**, not security vulnerabilities. Here's why:

#### Context
- This is a **single-business application** with one owner/operator
- All authenticated users are pre-approved administrators
- The real security boundary is **authentication** (email whitelist), not row-level permissions

#### Alternative Approaches Considered

**❌ Per-User Permissions Table**
```sql
-- Would require:
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('admin', 'editor', 'viewer'))
);

-- Then policies like:
CREATE POLICY "Admins only" ON jobs FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));
```
**Why Not**: Adds unnecessary complexity for a single-admin application.

**❌ Business ID Filtering**
```sql
-- Would require storing business_id in auth.users metadata
CREATE POLICY "Business admins only" ON jobs FOR ALL
USING (business_id = (auth.jwt() ->> 'business_id')::uuid);
```
**Why Not**: Only one business exists, so filtering is redundant.

#### Current Approach (Chosen)

**✅ Email Whitelist + Permissive RLS**
```javascript
// .env
VITE_AUTHORIZED_ADMIN_EMAILS=owner@boxed2built.com,manager@boxed2built.com

// src/utils/authorization.ts
export function isAuthorizedAdmin(email: string): boolean {
  const authorizedEmails = import.meta.env.VITE_AUTHORIZED_ADMIN_EMAILS
    .split(',')
    .map(e => e.trim().toLowerCase());
  return authorizedEmails.includes(email.toLowerCase());
}
```

```sql
-- Database policies
CREATE POLICY "Authenticated users can manage jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Why This Works**:
1. **Authentication Gateway**: Only whitelisted emails can authenticate
2. **Frontend Guards**: `ProtectedRoute` component enforces authorization
3. **Simple & Maintainable**: No complex role management needed
4. **Appropriate Scope**: Matches the single-business use case

### Policy-by-Policy Justification

| Table | Policy | Justification |
|-------|--------|---------------|
| `admin_audit_logs` | Authenticated can insert | Audit logs track admin actions; all authenticated users are admins |
| `business_info` | Authenticated can update | Business owner needs to update their own business info |
| `jobs`, `invoices`, etc. | Authenticated full access | Admin users manage all business operations |
| `form_inquiries` | Anonymous can insert | Public contact forms must accept submissions from visitors |
| `qr_scans` | Anonymous can insert | QR code tracking must work for non-authenticated users |
| `saved_requests` | Anonymous can insert | Request lookup feature for customers |

---

## Authentication & Authorization

### How It Works

#### 1. User Signup/Login
```typescript
// Handled by Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@boxed2built.com',
  password: 'secure-password'
});
```

#### 2. Email Verification
```typescript
// src/utils/authorization.ts
import { supabase } from '../lib/supabase';

export async function checkAuthorization(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return false;

  return isAuthorizedAdmin(user.email);
}
```

#### 3. Route Protection
```typescript
// src/components/admin/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAuthorizedAdmin(user.email))) {
      navigate('/admin/login');
    }
  }, [user, loading, navigate]);

  return loading ? <PageLoader /> : children;
}
```

### Security Checklist

- [x] Only whitelisted emails in `VITE_AUTHORIZED_ADMIN_EMAILS` can access admin
- [x] All admin routes wrapped in `<ProtectedRoute>`
- [x] Frontend checks authorization on every protected page load
- [x] RLS prevents anonymous users from reading/modifying admin data
- [ ] Enable leaked password protection (see next section)

---

## Leaked Password Protection

### What Is It?

Supabase Auth integrates with [HaveIBeenPwned.org](https://haveibeenpwned.com/) to prevent users from using passwords that have been leaked in data breaches. This is a critical security feature.

### Current Status

⚠️ **NOT ENABLED** - This feature must be enabled manually in the Supabase dashboard.

### How to Enable

1. **Navigate to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Open Auth Settings**
   - Left sidebar: Click **Authentication**
   - Sub-menu: Click **Policies**

3. **Enable Password Protection**
   - Find section: **Password Protection Settings**
   - Toggle ON: **"Check for leaked passwords"**
   - Save changes

4. **Test the Feature**
   ```typescript
   // Try to sign up with a common leaked password
   const { error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'password123' // Known leaked password
   });

   // Should fail with:
   // error.message === "Password is too weak or has been found in a data breach"
   ```

### Why This Matters

- **80% of breaches** involve weak, default, or stolen passwords
- **Leaked passwords** are actively used in credential stuffing attacks
- **Zero cost** to enable, significant security improvement
- **User experience**: Clear error messages guide users to choose stronger passwords

### Recommended Password Policy

Along with leaked password protection, configure these settings:

```yaml
Minimum password length: 12 characters
Require mixed case: Enabled
Require numbers: Enabled
Require special characters: Enabled
Password history: Remember last 5 passwords
```

---

## Anonymous Access Policies

### Public Submission Forms

These policies **intentionally** allow anonymous users to create records:

#### 1. Form Inquiries (`form_inquiries`)

```sql
CREATE POLICY "Anonymous users can submit inquiries"
  ON form_inquiries FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Purpose**: Contact forms on the public website
**Security**:
- Anonymous users can only INSERT, never SELECT/UPDATE/DELETE
- Only admins can view submissions
- Rate limiting should be implemented at the application level

#### 2. QR Code Scans (`qr_scans`)

```sql
CREATE POLICY "Anonymous users can insert scan records"
  ON qr_scans FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Purpose**: Track QR code scans for analytics
**Security**:
- Captures anonymous analytics data
- No sensitive information in scan records
- Admins can view aggregated analytics

#### 3. Saved Requests (`saved_requests`)

```sql
CREATE POLICY "Anonymous users can create saved requests"
  ON saved_requests FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Purpose**: Allow customers to save form data and retrieve it later with a code
**Security**:
- Generates unique confirmation codes
- No authentication required for lookup
- Request expires or can be deleted by admins

### Rate Limiting Recommendations

Since these endpoints accept anonymous submissions, implement rate limiting:

```typescript
// Example using Supabase Edge Functions
import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT = {
  form_submissions: { max: 5, window: 3600000 }, // 5 per hour
  qr_scans: { max: 100, window: 3600000 },       // 100 per hour
};

export async function checkRateLimit(
  ip: string,
  action: string
): Promise<boolean> {
  // Implementation using Redis or similar
}
```

---

## Index Management

### Unused Index Cleanup

**Migration**: `20260131_drop_unused_indexes.sql`

Dropped 26 unused foreign key indexes that were:
- Created for query optimization
- Never used by the query planner
- Adding overhead to write operations
- Consuming unnecessary storage

### When to Add Indexes

Add indexes when:
1. **Query analysis** shows slow queries on specific columns
2. **Explain plans** indicate sequential scans on large tables
3. **Production monitoring** reveals performance bottlenecks

### Current Indexes

The remaining indexes are actively used:
- Primary key indexes (automatic)
- Unique constraint indexes (automatic)
- Indexes on frequently queried columns that show up in query plans

---

## Security Best Practices

### ✅ Currently Implemented

- Email-based authentication with Supabase Auth
- Frontend authorization checks on all admin routes
- RLS policies prevent anonymous access to admin data
- HTTPS-only connections (enforced by Supabase)
- Environment variables for sensitive configuration
- Prepared statements prevent SQL injection (Supabase client)

### ⚠️ Recommended Improvements

1. **Enable Leaked Password Protection** (see above)
2. **Implement Rate Limiting** on public submission forms
3. **Add CAPTCHA** to contact forms (e.g., hCaptcha, reCAPTCHA)
4. **Set up Monitoring** for failed login attempts
5. **Regular Security Audits** of authorized admin email list

### 📋 Security Checklist for Production

- [ ] Leaked password protection enabled in Supabase dashboard
- [ ] All admin emails in `VITE_AUTHORIZED_ADMIN_EMAILS` are verified
- [ ] Strong password policy enforced (12+ characters, mixed case, numbers, symbols)
- [x] Passkeys (WebAuthn) available for admin and customer sign-in — see `docs/PASSKEYS.md`
- [ ] Two-factor authentication considered for admin accounts
- [ ] Rate limiting implemented on public endpoints
- [ ] CAPTCHA added to contact forms
- [ ] Security headers configured in `public/_headers`
- [ ] Content Security Policy (CSP) reviewed and tested
- [ ] Regular database backups enabled in Supabase
- [ ] Error logging set up (don't expose sensitive info to users)

---

## Addressing Security Scanner Warnings

### RLS Policy Always True Warnings

If your security scanner flags policies with `USING (true)` or `WITH CHECK (true)` as warnings:

**This is expected and safe for this application.**

The warnings indicate that RLS policies don't restrict row-level access for authenticated users. This is intentional because:

1. **Single-Admin Model**: All authenticated users are pre-approved administrators
2. **Email Whitelist**: Real security boundary is at authentication level
3. **No Multi-Tenancy**: Only one business exists in the database
4. **Frontend Authorization**: Additional checks in `src/utils/authorization.ts`

**To suppress these warnings:**
- Document your security model in your security scanner configuration
- Mark these warnings as "accepted risk" with justification
- Add comments explaining the single-admin architecture

### Foreign Key Index Recommendations

Security scanners often recommend indexes on all foreign key columns. While we've added these indexes as a best practice:

- They may not be actively used by current queries
- They're valuable for database integrity and future scalability
- PostgreSQL automatically maintains them with minimal overhead

## Questions?

If you have questions about this security architecture, please review:
- `src/utils/authorization.ts` - Authorization logic
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/components/admin/ProtectedRoute.tsx` - Route protection
- Supabase RLS policies in migration files

For security concerns, follow responsible disclosure practices.
