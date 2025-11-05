# Enable Leaked Password Protection

## Overview
Supabase Auth can check passwords against the HaveIBeenPwned database to prevent users from using compromised passwords. This is a recommended security feature.

## How to Enable

This setting must be configured in the Supabase Dashboard:

1. **Navigate to Authentication Settings**
   - Go to your Supabase project dashboard
   - Click on "Authentication" in the left sidebar
   - Click on "Policies" or "Settings"

2. **Enable Password Protection**
   - Look for "Password Protection" or "Breached Password Protection" setting
   - Enable "Check passwords against HaveIBeenPwned"
   - This will prevent users from signing up or updating their password with known compromised passwords

3. **Configuration Options**
   - **Strict Mode**: Reject passwords that have been seen in data breaches
   - **Warning Mode**: Allow but warn users about compromised passwords

## Benefits

- **Enhanced Security**: Prevents use of passwords known to be compromised
- **User Protection**: Helps protect users from credential stuffing attacks
- **Compliance**: Demonstrates security best practices
- **No Performance Impact**: Checks are done using k-anonymity (only partial hash is sent)

## Privacy

The HaveIBeenPwned integration uses k-anonymity:
- Only the first 5 characters of the SHA-1 password hash are sent
- Full passwords are never transmitted
- The response contains a list of all hash suffixes to check locally

## Implementation Status

✅ **Database security fixed** - All indexes and functions secured
⚠️ **Leaked password protection** - Must be enabled in Supabase Dashboard (cannot be set via SQL)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/passwords)
