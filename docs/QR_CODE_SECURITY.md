# QR Code System Security Configuration

## Security Issues Resolved

### 1. Multiple Permissive Policies - FIXED ✓
**Issue**: Overlapping RLS policies for authenticated users created potential security gaps.

**Resolution**: Consolidated policies:
- **Public users**: Can only read active QR codes and schedules (for redirect functionality)
- **Authenticated users**: Full management access (ALL operations)

### 2. Function Search Path Mutable - FIXED ✓
**Issue**: The `update_qr_code_timestamp()` function had a mutable search path, which could be exploited.

**Resolution**: Set immutable search path with `SET search_path = public` and `SECURITY DEFINER`.

### 3. Unused Indexes - NOT AN ISSUE ⚠️
**Status**: These warnings are **false positives** for new systems.

**Explanation**:
- All indexes are marked as "unused" because the system is brand new
- No queries have run yet to utilize these indexes
- These indexes are **critical for production performance**
- They will be automatically used once the system receives traffic

**Indexes that will be utilized**:
- `idx_qr_codes_slug` - Essential for fast slug lookups on redirects
- `idx_qr_codes_business_id` - Required for listing QR codes by business
- `idx_qr_codes_status` - Optimizes filtering by active/inactive status
- `idx_qr_code_schedules_datetime` - Critical for finding active schedules
- `idx_qr_scans_scanned_at` - Necessary for analytics time-series queries

**Do NOT drop these indexes** - they will significantly impact performance once the system is in production use.

## Additional Security Configuration Required

### Leaked Password Protection (Requires Dashboard Action)

**What it is**: Supabase Auth can check passwords against the HaveIBeenPwned database to prevent use of compromised passwords.

**How to enable**:

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication** → **Providers** → **Email**
3. Scroll to **Password Requirements**
4. Toggle **"Check against leaked password databases"** to **ON**
5. Click **Save**

**Benefits**:
- Prevents users from using passwords that have been leaked in data breaches
- Adds an extra layer of security to your authentication system
- Automatic checking via HaveIBeenPwned.org API

**Note**: This setting cannot be configured via migrations - it must be set through the Supabase dashboard.

## Security Best Practices

### QR Code Security

1. **Always use HTTPS** for destination URLs
2. **Monitor scan logs** for suspicious activity
3. **Use unique slugs** that aren't easily guessable
4. **Deactivate unused QR codes** instead of deleting them (preserves analytics)
5. **Review scheduled redirects** before they go live

### Database Security

1. **Row Level Security (RLS)** is enabled on all tables
2. **Public access** is restricted to:
   - Reading active QR codes (for redirects)
   - Inserting scan records (for analytics)
3. **Authenticated access** (admin only) for all management operations
4. **No data exposure** - inactive QR codes return 404 to public

### API Security

1. All admin operations require authentication
2. Scan tracking is anonymous (no PII collected by default)
3. Rate limiting should be implemented at the application level for `/go/:slug` endpoints
4. Consider adding IP-based rate limiting for scan endpoints to prevent abuse

## Monitoring Recommendations

### Security Monitoring

1. **Track failed scan attempts** - Multiple 404s from same IP could indicate probing
2. **Monitor unusual scan patterns** - Sudden spikes in scans from single location
3. **Review schedule changes** - Audit log tracks all modifications
4. **Check for slug enumeration** - Sequential slug attempts could be malicious

### Performance Monitoring

Once in production, monitor:
- Query performance on slug lookups
- Schedule query execution times
- Scan insert latency
- Analytics query performance

If any queries are slow despite indexes, run `ANALYZE` on the tables to update statistics.

## Compliance Notes

### Data Privacy

The QR code system collects:
- User agent strings
- IP addresses (optional - currently empty in implementation)
- Referrer URLs
- Device/browser information

**GDPR/Privacy Considerations**:
- Consider adding a privacy notice about scan tracking
- Implement data retention policies for scan data
- Allow users to opt-out of detailed tracking
- Consider anonymizing IP addresses before storage

### Data Retention

Recommended retention policies:
- **Active QR codes**: Keep indefinitely while in use
- **Inactive QR codes**: Archive after 90 days of inactivity
- **Scan data**: Retain for 12 months, then aggregate/delete
- **Schedule history**: Keep for audit purposes

Implement retention with periodic cleanup jobs or set up automated policies in Supabase.
