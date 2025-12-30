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
      session_recording: {
        enabled: true,
        recordCrossOriginIframes: false,
      },
      disable_session_recording: false,
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          console.log('PostHog loaded successfully');
        }
      },
    });
  }
};

export { posthog };
