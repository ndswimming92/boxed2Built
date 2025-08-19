// Google Analytics and GoatCounter analytics utility functions
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
    goatcounter: {
      count: (options: { path?: string; title?: string; event?: boolean }) => void;
    };
  }
}

// Google Analytics event tracking
export const trackGAEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'engagement',
      event_label: eventName,
      ...parameters
    });
  }
};

// Google Analytics page view tracking
export const trackGAPageView = (path: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-ZY3PG1S68G', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.href
    });
  }
};

// Combined event tracking (both GA4 and GoatCounter)
export const trackEvent = (eventName: string, path?: string) => {
  // Track with Google Analytics
  trackGAEvent(eventName, {
    event_category: 'user_interaction',
    custom_parameter_1: path || eventName
  });

  // Track with GoatCounter
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path: path || eventName,
      title: eventName,
      event: true,
    });
  }
};

// Combined page view tracking (both GA4 and GoatCounter)
export const trackPageView = (path: string, title?: string) => {
  // Track with Google Analytics
  trackGAPageView(path, title);

  // Track with GoatCounter
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path,
      title,
    });
  }
};