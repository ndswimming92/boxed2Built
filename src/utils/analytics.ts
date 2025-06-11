// GoatCounter analytics utility functions
declare global {
  interface Window {
    goatcounter: {
      count: (options: { path?: string; title?: string; event?: boolean }) => void;
    };
  }
}

export const trackEvent = (eventName: string, path?: string) => {
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path: path || eventName,
      title: eventName,
      event: true,
    });
  }
};

export const trackPageView = (path: string, title?: string) => {
  if (typeof window !== 'undefined' && window.goatcounter) {
    window.goatcounter.count({
      path,
      title,
    });
  }
};