# Enable Leaked Password Protection

## Overview
Supabase Auth can prevent users from using compromised passwords by checking against the HaveIBeenPwned.org database. This feature needs to be enabled through the Supabase Dashboard.

## Steps to Enable

1. **Navigate to Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Open Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Click on "Policies" or "Settings"

3. **Enable Leaked Password Protection**
   - Look for "Security" or "Password Settings" section
   - Find the option "Enable leaked password protection"
   - Toggle it ON
   - Save changes

## What This Does

When enabled, Supabase will:
- Check passwords against the HaveIBeenPwned database during signup
- Prevent users from using known compromised passwords
- Improve overall account security
- Not store or transmit actual passwords (uses k-anonymity API)

## Alternative: API Method

If available through the Management API, you can also enable it programmatically:

```bash
curl -X PATCH 'https://api.supabase.com/v1/projects/{project-ref}/config/auth' \
  -H "Authorization: Bearer {service-role-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "security_enable_leaked_password_protection": true
  }'
```

## Verification

After enabling, test by:
1. Attempting to sign up with a known compromised password (e.g., "password123")
2. The system should reject it with an appropriate error message

## References

- [HaveIBeenPwned API Documentation](https://haveibeenpwned.com/API/v3)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
