# Security Configuration Guide

## Completed Security Fixes

### 1. Function Search Path Security ✅

**Issue:** Function `update_form_inquiries_updated_at` had a mutable search_path which could lead to search path injection attacks.

**Fix Applied:** Updated the function to use `SECURITY DEFINER` with `SET search_path = ''` to prevent potential security vulnerabilities.

**Status:** ✅ Fixed via migration `fix_security_issues_v2`

---

### 2. Database Indexes

**Issue:** Several indexes reported as "unused" by Supabase advisor.

**Explanation:** These indexes are intentional and necessary:

- **Foreign Key Indexes** (`business_id` columns): Essential for join performance and referential integrity
- **Status/Filter Indexes**: Required for efficient filtering operations in admin portal
- **Date Indexes**: Needed for sorting and date-range queries
- **Viewed Index**: Critical for real-time unread count queries

**Status:** ✅ No action needed - indexes are properly configured for production use

**Why They Appear Unused:**
- Database is new with minimal data
- Indexes become utilized as data volume grows
- Query optimizer will use them automatically when cost-effective

---

## Required Manual Configuration

### 3. Leaked Password Protection 🔒

**Issue:** Supabase Auth's leaked password protection is currently disabled.

**What It Does:** Prevents users from using passwords that have been compromised in data breaches by checking against the HaveIBeenPwned.org database.

**How to Enable:**

1. Log in to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Scroll to **Security and Protection** section
4. Find **"Password protection"** settings
5. Enable **"Check for compromised passwords"**
6. Save changes

**Recommended Settings:**
- ✅ Enable "Check for compromised passwords"
- ✅ Block users from using compromised passwords
- ✅ Show helpful error message when password is rejected

**Benefits:**
- Protects user accounts from credential stuffing attacks
- Prevents use of known compromised passwords
- No impact on user experience for secure passwords
- Free service provided by HaveIBeenPwned.org

---

## Security Best Practices Applied

### Database Level
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Restrictive policies requiring authentication
- ✅ Proper foreign key constraints
- ✅ Indexes on filtered/joined columns
- ✅ Secure function execution with empty search_path

### Application Level
- ✅ Authentication required for admin portal
- ✅ Session persistence disabled for public client
- ✅ No secrets exposed in client-side code
- ✅ Proper error handling and logging
- ✅ Input validation on all forms

### Communication Level
- ✅ Email/SMS templates sanitized
- ✅ Communication history logged
- ✅ No sensitive data in notification payloads
- ✅ Proper CORS configuration

---

## Monitoring & Maintenance

### Regular Security Checks

1. **Monthly: Review Unused Indexes**
   - Check if patterns change with data growth
   - Remove truly unused indexes after 3+ months

2. **Quarterly: Audit RLS Policies**
   - Verify policies still match business requirements
   - Test with different user roles

3. **Continuous: Monitor Auth Logs**
   - Watch for failed login attempts
   - Check for suspicious patterns
   - Review password change requests

### Performance Monitoring

The indexes will become more valuable as your data grows:

| Table | Current | When Index Helps |
|-------|---------|------------------|
| form_inquiries | < 100 rows | > 1,000 rows |
| jobs | < 100 rows | > 1,000 rows |
| gallery_items | < 50 rows | > 500 rows |
| services | < 20 rows | Any volume |

---

## Questions?

If you need help with any security configurations or have questions about the setup, refer to:

- [Supabase Security Documentation](https://supabase.com/docs/guides/auth/auth-helpers)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
