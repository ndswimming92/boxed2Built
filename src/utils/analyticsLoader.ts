const GA_MEASUREMENT_ID = 'G-ZY3PG1S68G';
let gaLoadPromise: Promise<void> | null = null;

const configureGoogleAnalytics = () => {
  if (typeof window === 'undefined' || !window.gtag) return;

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
};

const injectGoogleAnalyticsScript = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector('script[data-analytics="ga4"]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.dataset.analytics = 'ga4';
  document.head.appendChild(script);
};

export const loadGoogleAnalytics = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.gtag) {
    return Promise.resolve();
  }

  if (gaLoadPromise) {
    return gaLoadPromise;
  }

  gaLoadPromise = new Promise((resolve) => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: any[]) {
      window.dataLayer.push(args);
    };

    injectGoogleAnalyticsScript();
    configureGoogleAnalytics();
    resolve();
  });

  return gaLoadPromise;
};
