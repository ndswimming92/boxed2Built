import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

export const initPostHog = () => {
  if (POSTHOG_KEY && typeof window !== 'undefined') {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      capture_dead_clicks: false,
      capture_performance: false,
      session_recording: {
        enabled: false,
        recordCrossOriginIframes: false,
      },
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          console.log('PostHog loaded successfully');
        }
      },
    });
  }
};

export { posthog };
