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

✅ **Database security fixed** - All unused indexes removed, function search paths secured
⚠️ **Leaked password protection** - Must be enabled in Supabase Dashboard (cannot be set via SQL)

## Security Fixes Applied

### Database Optimization and Security (Applied via Migration)

1. **Removed Unused Indexes** - Dropped 17 unused indexes to reduce overhead:
   - Business-related table indexes (address, attributes, reviews, gallery, etc.)
   - Form inquiry indexes (status, viewed, submission_date)
   - Revenue forecasting indexes (business_id, forecast_date, composite)

2. **Fixed Function Search Paths** - All trigger functions now use immutable search paths:
   - `update_revenue_forecasts_updated_at`
   - `update_forecast_settings_updated_at`
   - `update_jobs_updated_at`
   - `update_gallery_items_updated_at`
   - `update_form_inquiries_updated_at`

These functions now include:
- `SECURITY DEFINER` for controlled execution context
- `SET search_path = public` to prevent search path manipulation attacks

### Manual Configuration Required

**Leaked Password Protection** must be enabled through Supabase Dashboard:

1. Navigate to: **Project Settings → Authentication → Policies**
2. Find: **"Breached Password Protection"** section
3. Enable: **"Check passwords against HaveIBeenPwned database"**
4. Save changes

This setting cannot be configured via SQL migrations and requires dashboard access.

## Security Impact

- **Reduced Attack Surface**: Removed unnecessary indexes that could be exploited
- **Function Security**: Protected trigger functions from search path manipulation
- **Password Security**: When enabled, prevents use of compromised passwords
- **Performance**: Reduced index maintenance overhead

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/passwords)
- [PostgreSQL Function Security](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
