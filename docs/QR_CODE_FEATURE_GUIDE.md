# QR Code Management System - User Guide

## Overview

The QR Code Management System allows you to create dynamic QR codes with time-based redirects. Perfect for marketing campaigns, seasonal promotions, and events where the destination needs to change over time.

## Key Features

### 1. Dynamic QR Codes
- Create QR codes with custom short URLs (e.g., `yoursite.com/go/promo`)
- Each QR code has a default destination URL
- QR codes can be activated/deactivated without changing the code itself

### 2. Time-Based Redirects (Schedules)
- Add unlimited scheduled redirects to any QR code
- Set start and end dates/times for each schedule
- Priority system resolves conflicts when schedules overlap
- Active schedule takes precedence over default URL

### 3. Multi-Format Downloads
- **PNG**: 300px, 600px, 1200px (for business cards, flyers, posters)
- **SVG**: Vector format for professional printing
- **PDF**: Letter-size document with QR code and URL

### 4. Comprehensive Analytics
- Total scans and unique scans tracking
- Device breakdown (mobile, tablet, desktop)
- Browser and OS detection
- Referrer tracking
- Time-series scan charts
- Export to CSV for detailed analysis

## How to Use

### Creating a QR Code

1. Navigate to **Admin → QR Codes**
2. Click **Create QR Code**
3. Fill in the form:
   - **Title**: Internal name (e.g., "Spring 2024 Promo")
   - **Slug**: URL-friendly identifier (e.g., "spring-promo")
     - Auto-generate from title or create custom
     - Must be unique across all QR codes
   - **Default Destination URL**: Where users go when no schedule is active
   - **Description**: Internal notes (optional)
   - **Status**: Active or Inactive
4. Click **Create QR Code**

**Your short URL**: `yoursite.com/go/spring-promo`

### Adding Time-Based Schedules

After creating a QR code:

1. Click **Edit** on your QR code
2. Go to **Scheduled Redirects** tab
3. Click **Add Schedule**
4. Configure:
   - **Destination URL**: Where to redirect during this period
   - **Start Date & Time**: When this schedule becomes active
   - **End Date & Time**: When this schedule expires
   - **Priority**: Higher numbers take precedence (0 = lowest)
   - **Active**: Toggle to enable/disable without deleting
5. Click **Add Schedule**

**Example Schedule**:
- Black Friday promo: Nov 24-27, Priority 10
- Cyber Monday promo: Nov 27-30, Priority 10
- General holiday sale: Nov 1-Dec 31, Priority 5

Result: Black Friday URL shows Nov 24-27, Cyber Monday shows Nov 27-30, holiday sale shows all other days in Nov-Dec, default URL shows rest of year.

### Downloading QR Codes

1. Click **Edit** on your QR code
2. Go to **Preview & Download** tab
3. Choose your format:
   - **Small PNG (300×300)**: Business cards, small prints
   - **Medium PNG (600×600)**: Flyers, brochures
   - **Large PNG (1200×1200)**: Posters, banners
   - **SVG**: Professional printing, scales infinitely
   - **PDF**: Ready-to-print document with URL
4. Click the download button for your chosen format

### Viewing Analytics

1. Click the **eye icon** next to any QR code
2. Or navigate to **Admin → QR Codes → [Your QR Code]**
3. View metrics:
   - Total scans over time
   - Device breakdown pie chart
   - Top referrer sources
   - Recent scan details
4. Change date range: 7 days, 30 days, 90 days, or all time
5. Export data to CSV for external analysis

## Use Cases

### Marketing Campaigns

**Problem**: Print QR codes on flyers for a campaign that changes monthly.

**Solution**:
- Print one QR code: `yoursite.com/go/monthly-offer`
- Create schedules for each month pointing to different offers
- No need to reprint materials each month

### Events

**Problem**: QR codes on conference badges should show schedule before event, slides during, and recordings after.

**Solution**:
- Create QR code: `yoursite.com/go/conference2024`
- Schedule 1: Jan 1-14 → Registration page (Priority 10)
- Schedule 2: Jan 15 → Live schedule (Priority 10)
- Schedule 3: Jan 16-31 → Session recordings (Priority 10)
- Default: Next year's event page (Priority 0)

### Seasonal Promotions

**Problem**: Restaurant menu QR codes should show seasonal specials automatically.

**Solution**:
- Create QR code: `yoursite.com/go/menu`
- Spring schedule: Mar 1 - May 31 → Spring menu
- Summer schedule: Jun 1 - Aug 31 → Summer menu
- Fall schedule: Sep 1 - Nov 30 → Fall menu
- Winter schedule: Dec 1 - Feb 28 → Winter menu
- Default: Regular menu

### A/B Testing

**Problem**: Test which landing page converts better via QR codes.

**Solution**:
- Create two QR codes with same default URL
- Add alternating schedules pointing to variant A and B
- Compare scan analytics to see which performs better

## Best Practices

### Slug Naming

✅ Good slugs:
- `spring-2024`
- `black-friday`
- `conference-booth`
- `menu-table-5`

❌ Avoid:
- `promo1`, `promo2` (not descriptive)
- Random strings (hard to remember/manage)
- Very long slugs (harder to type if needed)

### Schedule Management

1. **Test schedules before they go live** using the "Test Scan" button
2. **Use priority wisely**:
   - High priority (10): Time-sensitive campaigns
   - Medium priority (5): Seasonal content
   - Low priority (0-2): Evergreen content
3. **Overlap intentionally**: Higher priority wins during conflicts
4. **Disable, don't delete**: Keep schedule history for reference

### Print Quality

- **Business cards**: 300px PNG minimum
- **Flyers/brochures**: 600px PNG recommended
- **Posters/banners**: 1200px PNG or SVG
- **Professional printing**: Always use SVG for best quality
- **Digital use**: 300-600px PNG is sufficient

### Security

1. **Use HTTPS URLs** for all destinations
2. **Monitor for abuse**: Check analytics for unusual patterns
3. **Deactivate when done**: Inactive codes show 404 to prevent misuse
4. **Don't use predictable slugs** for sensitive content

## Troubleshooting

### "QR Code Not Found" Error

**Causes**:
- QR code is inactive
- Slug was typed incorrectly
- QR code was deleted

**Solution**: Check status in admin panel, reactivate if needed.

### Schedule Not Working

**Causes**:
- Schedule is disabled
- Dates are incorrect (check timezone)
- Lower priority than overlapping schedule
- Parent QR code is inactive

**Solution**: Verify schedule is active, dates are correct, and QR code status is active.

### Scans Not Appearing in Analytics

**Causes**:
- Very recent scans (may take a few seconds to appear)
- Browser blocking JavaScript
- User didn't complete redirect

**Solution**: Wait a few moments and refresh. Most scans are logged immediately.

### QR Code Won't Scan

**Causes**:
- Print quality too low
- QR code too small
- Damaged or obscured code

**Solution**: Use higher resolution (SVG or 1200px PNG), print larger, ensure high contrast.

## Technical Details

### Short URL Format

All QR codes use the pattern: `yoursite.com/go/{slug}`

The `/go/` prefix keeps URLs short while remaining readable and SEO-friendly.

### Redirect Behavior

1. User scans QR code
2. System logs scan details (device, browser, referrer)
3. System checks for active schedules (by priority)
4. If active schedule found → Redirect to schedule URL
5. If no active schedule → Redirect to default URL
6. If QR code inactive → Show 404 error

### Data Collected

Per scan:
- Timestamp
- Device type (mobile/tablet/desktop)
- Browser name
- Operating system
- Referrer URL
- UTM parameters (if present)

**Not collected** (privacy-focused):
- No personally identifiable information
- IP addresses are logged but blank by default
- No cookies or tracking pixels

### Performance

- **Redirect speed**: < 200ms typically
- **Cache**: QR codes cached for fast lookups
- **Scalability**: Handles thousands of scans per minute
- **Database**: Optimized indexes for instant slug resolution

## Support

For issues or questions:
1. Check this guide first
2. Review analytics for scan patterns
3. Verify schedule dates and priorities
4. Test QR code with "Test Scan" button
5. Check QR code status (active/inactive)

The system is designed to be intuitive and self-service - most issues can be resolved by reviewing the configuration in the admin panel.
