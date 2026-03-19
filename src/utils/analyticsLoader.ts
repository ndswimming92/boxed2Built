const GA_MEASUREMENT_ID = 'G-ZY3PG1S68G';
const GA_SCRIPT_SELECTOR = 'script[data-analytics="ga4"]';
let gaLoadPromise: Promise<void> | null = null;
let gaConfigured = false;

const configureGoogleAnalytics = () => {
  if (typeof window === 'undefined' || !window.gtag || gaConfigured) return;

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
    allow_google_signals: true,
    allow_ad_personalization_signals: true,
    cookie_expires: 63072000,
    custom_map: {
      custom_parameter_1: 'source_detail',
      custom_parameter_2: 'user_type',
      custom_parameter_3: 'service_interest'
    },
    engagement_time_msec: 100,
    debug_mode: false
  });

  gaConfigured = true;
};

const ensureGoogleAnalyticsStub = () => {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag(...args: any[]) {
      window.dataLayer.push(args);
    };
  }
};

const injectGoogleAnalyticsScript = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve();

  const existingScript = document.querySelector<HTMLScriptElement>(GA_SCRIPT_SELECTOR);
  if (existingScript?.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const script = existingScript || document.createElement('script');

    const handleLoad = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => resolve(), { once: true });

    if (!existingScript) {
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.dataset.analytics = 'ga4';
      document.head.appendChild(script);
    }
  });
};

export const loadGoogleAnalytics = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (gaLoadPromise) {
    return gaLoadPromise;
  }

  ensureGoogleAnalyticsStub();
  configureGoogleAnalytics();

  gaLoadPromise = injectGoogleAnalyticsScript().then(() => {
    configureGoogleAnalytics();
  });

  return gaLoadPromise;
};
