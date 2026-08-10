# QR Code Management System

## Overview

The QR Code Management System provides a comprehensive solution for creating, managing, and tracking QR codes with time-based redirect capabilities. Perfect for seasonal campaigns, limited-time offers, and event-specific links.

## Features

### Core Functionality
- **Dynamic QR Code Creation**: Generate QR codes with custom slugs and destinations
- **Time-Based Redirects**: Set up multiple scheduled redirects per QR code
- **Multi-Format Downloads**: PNG (3 sizes), SVG, and PDF formats
- **Comprehensive Analytics**: Track scans by device, browser, OS, referrer, and time
- **Priority System**: Resolve overlapping schedules with configurable priorities
- **Scan Email Alerts**: Get an email on every scan with the running scan total and device details

### Database Schema

#### Tables
1. **qr_codes**: Main table storing QR code metadata
   - `id`, `business_id`, `slug`, `title`, `description`
   - `default_destination_url`, `status`
   - Notifications: `notify_on_scan`, `notification_email`
   - `created_at`, `updated_at`

2. **qr_code_schedules**: Time-based redirect schedules
   - `id`, `qr_code_id`, `destination_url`
   - `start_datetime`, `end_datetime`, `priority`
   - `is_active`, `created_at`, `updated_at`

3. **qr_scans**: Analytics and tracking data
   - `id`, `qr_code_id`, `scanned_at`
   - Device info: `user_agent`, `device_type`, `device_model`, `browser`,
     `browser_version`, `os`, `os_version`, `screen_resolution`, `language`, `timezone`
   - Location: `ip_address`, `country`, `region`, `city`
   - Marketing: `referrer`, `destination_url`, `utm_source`, `utm_medium`, `utm_campaign`
   - Notifications: `is_bot`, `notification_sent_at`

### Security

#### Row Level Security (RLS)
All tables have RLS enabled with the following policies:

**QR Codes**:
- Public can read active QR codes (for redirects)
- Authenticated users can view, create, update, and delete all QR codes

**QR Code Schedules**:
- Public can read active schedules for active QR codes
- Authenticated users have full access

**QR Scans**:
- Public can insert scan records (for tracking)
- Authenticated users can view and delete scan data

#### Critical Indexes
The following indexes are essential for performance:
- `idx_qr_codes_slug`: Fast public redirect lookups
- `idx_qr_codes_business_id`: Admin QR code listing
- `idx_qr_code_schedules_qr_code_id`: Schedule lookups
- `idx_qr_code_schedules_datetime`: Active schedule detection
- `idx_qr_scans_qr_code_id`: Analytics queries
- `idx_qr_scans_scanned_at`: Time-series analytics

## Usage Guide

### Admin Portal

#### Creating a QR Code
1. Navigate to **Admin > QR Codes**
2. Click **Create QR Code**
3. Fill in:
   - **Title**: Display name (e.g., "Spring 2024 Promo")
   - **Slug**: URL-friendly identifier (e.g., "spring-promo")
   - **Default Destination URL**: Fallback redirect URL
   - **Description**: Internal notes (optional)
4. Click **Create QR Code**

#### Adding Time-Based Schedules
1. Edit an existing QR code
2. Switch to **Scheduled Redirects** tab
3. Click **Add Schedule**
4. Configure:
   - **Destination URL**: Where to redirect during this timeframe
   - **Start Date & Time**: When schedule becomes active
   - **End Date & Time**: When schedule expires
   - **Priority**: Higher numbers win in conflicts (default: 0)
   - **Active**: Toggle to enable/disable
5. Click **Add Schedule**

#### Downloading QR Codes
1. Edit a QR code
2. Switch to **Preview & Download** tab
3. Choose format:
   - **PNG Small** (300×300px): Business cards
   - **PNG Medium** (600×600px): Flyers
   - **PNG Large** (1200×1200px): Posters
   - **SVG**: Professional printing (scales to any size)
   - **PDF**: Ready-to-print document

#### Viewing Analytics
1. Click on a QR code from the listing
2. View metrics:
   - Total scans and unique scans
   - Scan activity over time (line chart)
   - Device breakdown (pie chart)
   - Top referrers list
   - Recent scan details
3. Filter by date range: 7, 30, 90 days, or all time
4. Export data to CSV for deeper analysis

### Public Redirect System

#### URL Format
```
https://yourdomain.com/go/{slug}
```

#### Redirect Logic
1. System looks up QR code by slug
2. Checks if QR code is active
3. Searches for active schedules (within current date/time)
4. If multiple schedules match, uses highest priority
5. If no schedule matches, uses default destination URL
6. Posts the scan to the `notify-qr-scan` edge function, which records it and
   emails the business (see [Scan Email Notifications](#scan-email-notifications))
7. Redirects user to destination

The redirect never waits on the notification. The scan request is sent with
`keepalive: true` and raced against a 1.5 second timeout, so the visitor is
forwarded promptly even if the function is slow, and the request still
completes after the browser navigates away.

#### Example Flow
```
User scans QR code
  ↓
/go/summer-sale
  ↓
Schedule Check:
  - Memorial Day Sale: 5/25-5/27 (Priority: 10) ❌ Expired
  - Summer Sale: 6/1-8/31 (Priority: 5) ✅ Active
  ↓
Redirect to: https://example.com/summer-sale-2024
  ↓
Log scan data
```

### Scan Email Notifications

Every scan of an active QR code sends an email to the business. Notifications
are handled by the `notify-qr-scan` edge function rather than the browser,
because only the server can see the scanner's IP address and resolve its
location.

#### What each email contains
- **Which code was scanned**: title, slug, short URL, internal notes, and the
  destination the scan actually forwarded to (so a scheduled redirect is
  distinguishable from the default)
- **Scan total as of that scan**: the all-time count, plus counts for today and
  the last 7 days for context
- **Device**: type (mobile/tablet/desktop), model where the browser exposes it,
  OS and version, browser and version, screen size and pixel ratio, preferred
  language, and the device's own timezone
- **Location and network**: IP address, plus city/region/country when they can
  be resolved
- **Source**: referrer (or "Direct / camera app") and any UTM parameters on the
  scanned URL
- A link straight to that code's analytics page, and the raw user agent in a
  collapsed block

#### Where the details come from
| Source | Fields |
| --- | --- |
| Request headers at the edge | IP address, country/region/city via geo headers |
| `user-agent` header | device type, browser + version, OS + version, bot detection |
| UA Client Hints (`navigator.userAgentData`) | device model, OS version, browser version on Chromium/Android, where the plain user agent is frozen |
| Browser APIs | screen size, pixel ratio, language, IANA timezone |
| Scanned URL | UTM parameters |

Client hints are requested with `getHighEntropyValues` and degrade to empty
strings when a browser declines, so a scan is never lost over missing detail.

#### Configuration
Per QR code, under **Admin → QR Codes → Edit**:
- **Email me every time this code is scanned** — on by default for new and
  existing codes. Turn it off for a high-traffic code without affecting others.
- **Send notifications to** — optional per-code recipient. Blank uses the
  default address.

Edge function secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | Sends the email. Without it, scans are still recorded and the skip is logged. |
| `QR_SCAN_NOTIFY_EMAIL` | No | Default recipient. Defaults to the owner address. |
| `QR_SCAN_NOTIFY_MAX_PER_HOUR` | No | Cap on emails per code per hour (default `60`, `0` disables the cap). |
| `IPINFO_TOKEN` | No | Resolves city/region/country from the IP. Without it, location comes from edge geo headers only. |
| `SITE_URL` | No | Base URL used in the short URL and analytics link (default `https://boxed2built.com`). |

#### Scans that are logged but not emailed
Every scan is recorded in `qr_scans`; `notification_sent_at` records whether an
email went out, and the Recent Scans table shows this per row. An email is
skipped when:
- the code has `notify_on_scan` turned off
- the user agent looks like a crawler or link previewer (Slack, WhatsApp, and
  similar unfurlers hit the URL without a person scanning anything) — these are
  flagged `is_bot`
- the hourly cap for that code has been reached
- `RESEND_API_KEY` is not configured

#### Deployment
The function is public-facing (called by anonymous visitors mid-redirect) and
authenticates with the anon key like the other public functions:

```bash
supabase functions deploy notify-qr-scan
```

Apply `20260810120000_add_qr_scan_notifications.sql` before deploying — the
function selects the new `notify_on_scan` and `notification_email` columns.
If the function is unreachable, `logScan` falls back to inserting the scan
directly from the browser, so scan counts keep working without email.

### Marketing Use Cases

#### Seasonal Campaigns
Create a QR code for "spring-promo" that automatically switches destinations:
- March: Spring collection landing page
- April: Easter sale page
- May: Mother's Day gifts

#### Event Management
Single QR code on printed materials that updates destinations:
- Pre-event: Registration page
- During event: Live schedule and maps
- Post-event: Survey and photo gallery

#### Product Packaging
QR code on product that changes based on time:
- First 30 days: Setup guide and warranty registration
- 30-90 days: Tips and tricks content
- 90+ days: Reorder page and accessories

#### Restaurant Menus
QR code on table tents:
- Breakfast hours: Breakfast menu
- Lunch hours: Lunch specials
- Dinner hours: Dinner menu
- Late night: Limited menu

### API Integration

#### Creating QR Codes Programmatically
```typescript
import { createQRCode } from './services/qrCodeService';

const qrCode = await createQRCode(businessId, {
  slug: 'my-campaign',
  title: 'Q4 2024 Campaign',
  description: 'Holiday promotion',
  default_destination_url: 'https://example.com/holiday',
  status: 'active'
});
```

#### Adding Schedules
```typescript
import { createSchedule } from './services/qrCodeService';

await createSchedule({
  qr_code_id: qrCode.id,
  destination_url: 'https://example.com/black-friday',
  start_datetime: '2024-11-29T00:00:00Z',
  end_datetime: '2024-11-29T23:59:59Z',
  priority: 10,
  is_active: true
});
```

#### Fetching Analytics
```typescript
import { getScanAnalytics } from './services/qrScanService';

const analytics = await getScanAnalytics(
  qrCodeId,
  '2024-01-01T00:00:00Z', // Start date
  '2024-12-31T23:59:59Z'  // End date
);

console.log(`Total scans: ${analytics.total_scans}`);
console.log(`Device breakdown:`, analytics.device_breakdown);
```

## Best Practices

### Slug Naming
- Use lowercase letters, numbers, and hyphens only
- Keep slugs short and memorable
- Avoid special characters and spaces
- Examples: `spring-sale`, `menu-2024`, `event-reg`

### Schedule Management
- Set clear start and end times
- Use priority levels to manage overlaps
- Test redirects before going live
- Disable rather than delete schedules you might reuse

### Analytics
- Review scan data weekly
- Monitor device breakdown to optimize landing pages
- Track UTM parameters for campaign attribution
- Export data for deeper analysis in Excel/Sheets

### QR Code Printing
- Use high error correction (H level)
- Test scan on multiple devices before printing
- Include a short URL text below QR code as backup
- Print with sufficient contrast (dark on light)
- Minimum size: 2cm × 2cm for reliable scanning

### Security
- Regularly review and remove old QR codes
- Monitor scan patterns for unusual activity
- Use HTTPS for all destination URLs
- Keep slug names unpredictable for private links

## Troubleshooting

### QR Code Not Redirecting
1. Check QR code status is "active"
2. Verify slug is correct in URL
3. Test destination URL separately
4. Check if schedule is active for current time
5. Review priority settings if multiple schedules exist

### Analytics Not Showing
1. Ensure RLS policies allow authenticated access
2. Check date range filters
3. Verify QR code has been scanned
4. Allow time for real-time updates to propagate

### Download Issues
1. Clear browser cache
2. Try different format (PNG/SVG/PDF)
3. Check browser download settings
4. Disable popup blockers

## Performance Optimization

### Database Indexes
All critical indexes are automatically created:
- Slug lookups use `idx_qr_codes_slug` (unique)
- Schedule queries use composite datetime index
- Analytics queries use timestamp index

### Caching Recommendations
- Cache active QR code data for 5 minutes
- Cache schedule lookups for 1 minute
- Don't cache analytics (real-time data)

### Query Optimization
- Use `maybeSingle()` for single record lookups
- Batch schedule queries when possible
- Paginate scan data for large datasets
- Use date range filters in analytics queries

## Future Enhancements

### Potential Features
- Geolocation-based redirects
- A/B testing support
- Custom QR code designs with logos
- Bulk QR code generation
- API webhooks for scan events
- Advanced fraud detection
- Integration with Google Analytics
- Custom domains for short URLs
- QR code templates library
- Scheduled activation/deactivation

## Support

For issues or questions:
1. Check this documentation
2. Review the code comments in service files
3. Check Supabase logs for errors
4. Verify RLS policies are correct
5. Test with different user roles

## Additional Security Notes

### Leaked Password Protection
Supabase Auth includes protection against compromised passwords by checking against HaveIBeenPwned.org. To enable:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > Providers**
3. Scroll to **Security and Protection**
4. Enable **"Leaked Password Protection"**

This prevents users from signing up with passwords that have been compromised in data breaches.
