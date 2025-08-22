// Google Analytics and GoatCounter analytics utility functions
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
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

// Event tracking with Google Analytics
export const trackEvent = (eventName: string, path?: string) => {
  // Track with Google Analytics
  trackGAEvent(eventName, {
    event_category: 'user_interaction',
    custom_parameter_1: path || eventName
  });
};

// Page view tracking with Google Analytics
export const trackPageView = (path: string, title?: string) => {
  // Track with Google Analytics
  trackGAPageView(path, title);
};