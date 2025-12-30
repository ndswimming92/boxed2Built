# PostHog Analytics Setup Guide

This guide will help you set up PostHog analytics for your Boxed2Built application.

## What is PostHog?

PostHog is a comprehensive product analytics platform that helps you understand user behavior, track events, and improve your application. It includes:

- Event tracking and analytics
- Session recordings
- Feature flags
- A/B testing
- User identification and profiles
- Funnel analysis
- Retention tracking

## Setup Instructions

### 1. Create a PostHog Account

1. Go to [PostHog Cloud](https://app.posthog.com/signup)
2. Sign up for a free account
3. Complete the onboarding process

### 2. Get Your Project API Key

1. Once logged in, navigate to **Project Settings**
2. Go to the **Project API Key** section
3. Copy your **Project API Key**
4. Note your **API Host** (usually `https://us.i.posthog.com` for US region or `https://eu.i.posthog.com` for EU region)

### 3. Configure Environment Variables

Update your `.env` file with your PostHog credentials:

```env
VITE_POSTHOG_KEY=phc_your_actual_project_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

**Important:** Never commit your actual API keys to version control!

### 4. Verify Installation

1. Start your development server: `npm run dev`
2. Open your browser's developer console
3. You should see "PostHog loaded successfully" in the console (only in development mode)
4. Check your PostHog dashboard to see if events are being tracked

## What's Being Tracked

The application automatically tracks:

### Page Views
- All page navigation and route changes
- Page titles and URLs

### User Interactions
- Form submissions (contact forms, booking requests)
- Button clicks
- Link clicks
- Scroll depth (25%, 50%, 75%, 100%)
- Time on page

### Conversions
- Form completions
- Service inquiries
- Contact requests

### Engagement Metrics
- Session duration
- User engagement milestones
- Video interactions (play, pause, complete)

## Key Features Enabled

### 1. Autocapture
PostHog automatically captures:
- Clicks on buttons and links
- Form submissions
- Page views
- Page leaves

### 2. Session Recordings
Visual recordings of user sessions to understand:
- How users navigate your site
- Where users encounter issues
- User behavior patterns

**Note:** Session recordings are enabled by default. To disable them, update the PostHog configuration in `src/lib/posthog.ts`.

### 3. Event Tracking
Custom events are tracked for:
- Form interactions
- Conversion events
- User engagement milestones

## Dual Analytics Setup

This application tracks events with both Google Analytics and PostHog simultaneously. This provides:

- **Google Analytics**: Traditional web analytics and SEO insights
- **PostHog**: Product analytics and user behavior insights

## Viewing Your Analytics

### PostHog Dashboard

1. Log in to [PostHog](https://app.posthog.com)
2. Navigate to different sections:
   - **Insights**: Create custom charts and track specific metrics
   - **Recordings**: Watch user session recordings
   - **Events**: View all tracked events
   - **Persons**: See individual user profiles and their actions

### Common Insights to Create

1. **Conversion Funnel**
   - Page view → Contact page visit → Form submission

2. **Top Pages**
   - Most visited pages
   - Pages with highest engagement

3. **User Retention**
   - How often users return
   - Which pages drive repeat visits

## Privacy Considerations

PostHog respects user privacy:
- Session recordings do not capture sensitive input fields (passwords, credit cards)
- You can customize what data is captured
- GDPR compliant when configured properly

To further protect privacy, you can:
1. Disable session recordings
2. Configure data retention policies in PostHog settings
3. Anonymize IP addresses

## Troubleshooting

### PostHog Not Loading

1. Check your `.env` file has the correct credentials
2. Verify your PostHog API key is active
3. Check browser console for errors
4. Ensure your PostHog host URL is correct

### Events Not Appearing

1. Events may take a few seconds to appear in PostHog
2. Check if PostHog is initialized by looking for the console log
3. Verify your network connection
4. Check PostHog status page for service issues

### Local Development

PostHog works in development mode and will show console logs. In production builds, these logs are automatically hidden.

## Advanced Configuration

To customize PostHog settings, edit `src/lib/posthog.ts`:

```typescript
posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only', // Only create profiles for identified users
  capture_pageview: true, // Automatic pageview tracking
  capture_pageleave: true, // Track when users leave pages
  autocapture: true, // Automatic event capture
  session_recording: {
    enabled: true, // Enable session recordings
    recordCrossOriginIframes: false, // Don't record cross-origin iframes
  },
});
```

## Best Practices

1. **Monitor Event Volume**: Keep an eye on your event quota
2. **Create Meaningful Insights**: Set up dashboards for key metrics
3. **Use Session Recordings**: Review recordings to identify UX issues
4. **Segment Users**: Create user segments for targeted analysis
5. **Set Up Alerts**: Configure alerts for important events

## Support

- PostHog Documentation: https://posthog.com/docs
- PostHog Community: https://posthog.com/community
- PostHog Support: support@posthog.com

## Cost

PostHog offers a generous free tier:
- 1 million events per month
- Unlimited team members
- 5,000 session recordings per month

For higher usage, check PostHog's pricing page: https://posthog.com/pricing
