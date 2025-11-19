# Enable Leaked Password Protection

## ⚠️ Action Required

This security feature must be enabled manually through the Supabase Dashboard. It cannot be configured via SQL migrations.

## Overview
Supabase Auth can prevent users from using compromised passwords by checking against the HaveIBeenPwned.org database. This is a critical security feature that should be enabled for all production applications.

## Steps to Enable

### Method 1: Supabase Dashboard (Recommended)

1. **Navigate to Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Open Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Click on "Configuration" tab

3. **Enable Password Protection**
   - Scroll to the "Security and Protection" section
   - Find "Leaked Password Protection" or "Breached Password Protection"
   - Toggle the switch to **ON**
   - Click **Save** to apply changes

### Method 2: Supabase CLI (If Available)

If your Supabase CLI supports this configuration:

```bash
supabase settings update auth.security.enable_leaked_password_protection=true
```

## What This Does

When enabled, Supabase will:
- Check passwords against the HaveIBeenPwned database during signup
- Prevent users from using known compromised passwords
- Improve overall account security
- Not store or transmit actual passwords (uses k-anonymity API)

## How It Works (Privacy-Preserving)

The HaveIBeenPwned integration uses **k-anonymity** to protect user privacy:

1. Your password is hashed using SHA-1
2. Only the **first 5 characters** of the hash are sent to the API
3. The API returns ALL hashes that start with those 5 characters
4. Your system checks locally if the full hash is in that list
5. **Your actual password is NEVER transmitted**

Example:
- Password: `P@ssw0rd`
- SHA-1 Hash: `21BD12DC183F740EE76F27B78EB39C8AD972A757`
- Sent to API: `21BD1` (first 5 chars only)
- API returns: ~500 hash suffixes starting with `21BD1`
- Local match: Check if `2DC183F740EE76F27B78EB39C8AD972A757` is in the list

## Verification

After enabling, test by:
1. Try signing up with a common compromised password:
   - `password123`
   - `qwerty123`
   - `letmein`
2. The system should reject it with an error message like:
   - "This password has been found in a data breach"
   - "Please choose a different password"

## User Impact

**Positive:**
- ✅ Protects users from credential stuffing attacks
- ✅ Encourages strong, unique passwords
- ✅ Minimal performance impact (< 100ms latency)
- ✅ Fully privacy-preserving

**Minimal Friction:**
- Users with strong passwords won't notice any difference
- Only users trying to use compromised passwords will be prompted to choose another
- Clear error messages guide users to better security

## Why This Is Critical

- **Over 12 billion passwords** have been leaked in data breaches
- **81% of hacking-related breaches** use stolen or weak passwords
- Attackers use leaked password lists for credential stuffing attacks
- This protection helps prevent account takeovers before they happen

## Security Fixes Summary

This completes the security hardening of your Supabase project:

✅ **Fixed:** Unindexed foreign keys (added `idx_saved_requests_business_id_fk`)
✅ **Fixed:** RLS policies using `(select auth.uid())` for better performance
✅ **Fixed:** Function search path mutability issues
✅ **Fixed:** Removed 10 truly unused indexes
⚠️ **Manual Action Required:** Enable Leaked Password Protection in Dashboard

## References

- [HaveIBeenPwned API Documentation](https://haveibeenpwned.com/API/v3)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OWASP Password Security Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
