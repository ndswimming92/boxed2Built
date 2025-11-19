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

✅ **Foreign key indexes optimized** - Added required index for saved_requests.business_id
✅ **RLS policies optimized** - Using subqueries to prevent per-row function evaluation
✅ **Unused indexes removed** - Dropped truly unused indexes to reduce overhead
✅ **Function search paths secured** - All functions use immutable search paths
⚠️ **Leaked password protection** - Must be enabled in Supabase Dashboard (cannot be set via SQL)

## Security Fixes Applied

### Database Optimization and Security (Applied via Migration)

1. **Added Missing Foreign Key Index**:
   - `idx_saved_requests_business_id_fk` on `saved_requests(business_id)`
   - This was incorrectly identified as unused in previous migration
   - Required for optimal foreign key constraint performance

2. **Optimized RLS Policies** - Using subqueries to cache auth function results:
   - `notification_bar`: Changed `auth.uid()` to `(select auth.uid())`
   - `saved_requests`: Changed `auth.uid()` to `(select auth.uid())`
   - This prevents re-evaluation of auth functions for each row, improving query performance at scale

3. **Removed Truly Unused Indexes** - Dropped 10 indexes with zero query usage:
   - `idx_gallery_items_business_id`
   - `idx_payment_methods_business_id`
   - `idx_saved_requests_inquiry_id`
   - `idx_service_areas_business_id`
   - `idx_services_business_id`
   - `idx_social_media_business_id`
   - `idx_business_attributes_business_id`
   - `idx_customer_reviews_business_id`
   - `idx_forecast_accuracy_business_id`
   - `idx_business_address_business_id`

4. **Fixed Function Search Paths** - All trigger functions use immutable search paths:
   - `update_saved_requests_updated_at`
   - `track_saved_request_access`
   - `update_notification_bar_updated_at`
   - Plus all previously fixed functions

These functions now include:
- `SECURITY DEFINER` for controlled execution context
- `SET search_path = public, pg_temp` to prevent search path manipulation attacks

### Manual Configuration Required

**Leaked Password Protection** must be enabled through Supabase Dashboard:

1. Navigate to: **Project Settings → Authentication → Policies**
2. Find: **"Breached Password Protection"** section
3. Enable: **"Check passwords against HaveIBeenPwned database"**
4. Save changes

This setting cannot be configured via SQL migrations and requires dashboard access.

## Security Impact

- **Query Performance**: Added required foreign key index for optimal query execution
- **RLS Performance**: Optimized policies to cache auth function calls instead of per-row evaluation
- **Reduced Overhead**: Removed 10 truly unused indexes to reduce maintenance overhead
- **Function Security**: Protected all trigger functions from search path manipulation attacks
- **Password Security**: When enabled, prevents use of compromised passwords

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/passwords)
- [PostgreSQL Function Security](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
