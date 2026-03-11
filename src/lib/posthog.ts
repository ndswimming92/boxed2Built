let posthogInstancePromise: Promise<any | null> | null = null;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

const loadPostHog = async () => {
  if (!POSTHOG_KEY || typeof window === 'undefined') {
    return null;
  }

  if (!posthogInstancePromise) {
    posthogInstancePromise = import('posthog-js')
      .then((module) => {
        const posthog = module.default;
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
        });
        return posthog;
      })
      .catch(() => null);
  }

  return posthogInstancePromise;
};

export const initPostHog = async () => {
  await loadPostHog();
};

export const capturePostHogEvent = async (eventName: string, properties?: Record<string, unknown>) => {
  const posthog = await loadPostHog();
  posthog?.capture(eventName, properties);
};
