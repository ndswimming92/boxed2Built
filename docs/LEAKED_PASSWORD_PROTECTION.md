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

✅ **Foreign key indexes optimized** - All 15 foreign key indexes added for optimal performance
✅ **Function search paths secured** - All functions use immutable search paths (Dec 2024)
✅ **Security definer view removed** - Removed insecure recent_audit_logs view
✅ **Secure audit log function** - Added get_recent_audit_logs function with proper security
⚠️ **Leaked password protection** - Must be enabled in Supabase Dashboard (cannot be set via SQL)

## Security Fixes Applied

### Database Optimization and Security (Latest Migration: Dec 2024)

1. **Added All Missing Foreign Key Indexes** (15 total):
   - `idx_business_address_business_id` on `business_address(business_id)`
   - `idx_business_attributes_business_id` on `business_attributes(business_id)`
   - `idx_customer_reviews_business_id` on `customer_reviews(business_id)`
   - `idx_forecast_accuracy_business_id` on `forecast_accuracy(business_id)`
   - `idx_gallery_items_business_id` on `gallery_items(business_id)`
   - `idx_invoices_inquiry_id` on `invoices(inquiry_id)`
   - `idx_invoices_job_id` on `invoices(job_id)`
   - `idx_payment_methods_business_id` on `payment_methods(business_id)`
   - `idx_quarterly_tax_payments_business_id` on `quarterly_tax_payments(business_id)`
   - `idx_saved_requests_business_id` on `saved_requests(business_id)`
   - `idx_saved_requests_inquiry_id` on `saved_requests(inquiry_id)`
   - `idx_service_areas_business_id` on `service_areas(business_id)`
   - `idx_services_business_id` on `services(business_id)`
   - `idx_social_media_business_id` on `social_media(business_id)`
   - `idx_tax_calculations_business_id` on `tax_calculations(business_id)`

2. **Removed Insecure Security Definer View**:
   - Dropped `recent_audit_logs` view that exposed `auth.users` data
   - Replaced with secure function `get_recent_audit_logs()` that doesn't expose auth schema

3. **Fixed All Function Search Paths** - All functions now use immutable search paths:
   - `log_auth_event`
   - `calculate_goal_progress`
   - `update_overdue_goals`
   - `update_business_goals_updated_at`
   - `calculate_line_item_total`
   - Plus all previously fixed trigger functions

4. **Added Secure Audit Log Function**:
   - `get_recent_audit_logs(days_back integer)` - Secure function to retrieve audit logs
   - Uses `SECURITY DEFINER` with explicit `search_path = public, pg_temp`
   - Only accessible to authenticated users
   - Does not expose auth.users table data

All functions now include:
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
