// Google Analytics utility function
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
    dataLayer: any[];
  }
}

// Enhanced event parameters interface
export interface GAEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  custom_parameter_1?: string;
  page_location?: string;
  page_title?: string;
  user_engagement?: string;
  session_engaged?: boolean;
  engagement_time_msec?: number;
}

// Google Analytics event tracking
export const trackGAEvent = (eventName: string, parameters?: GAEventParams) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'engagement',
      event_label: eventName,
      page_location: window.location.href,
      page_title: document.title,
      ...parameters
    });
  }
};

// Enhanced conversion tracking
export const trackConversion = (action: string, value?: number, currency: string = 'USD') => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: 'G-ZY3PG1S68G',
      event_category: 'conversion',
      event_label: action,
      value: value,
      currency: currency,
      page_location: window.location.href,
      page_title: document.title
    });
  }
};

// Track form interactions
export const trackFormInteraction = (formName: string, action: 'start' | 'complete' | 'abandon', fieldName?: string) => {
  trackGAEvent(`form_${action}`, {
    event_category: 'form_interaction',
    event_label: formName,
    custom_parameter_1: fieldName || action,
    user_engagement: 'form_interaction'
  });
};

// Track scroll depth
export const trackScrollDepth = (percentage: number) => {
  trackGAEvent('scroll', {
    event_category: 'engagement',
    event_label: `${percentage}%`,
    value: percentage,
    user_engagement: 'scroll_depth'
  });
};

// Track time on page
export const trackTimeOnPage = (seconds: number) => {
  trackGAEvent('timing_complete', {
    event_category: 'engagement',
    event_label: 'time_on_page',
    value: seconds,
    engagement_time_msec: seconds * 1000
  });
};

// Track external link clicks
export const trackExternalLink = (url: string, linkText?: string) => {
  trackGAEvent('click', {
    event_category: 'external_link',
    event_label: url,
    custom_parameter_1: linkText || url,
    user_engagement: 'external_link_click'
  });
};

// Track file downloads
export const trackFileDownload = (fileName: string, fileType: string) => {
  trackGAEvent('file_download', {
    event_category: 'download',
    event_label: fileName,
    custom_parameter_1: fileType,
    user_engagement: 'file_download'
  });
};

// Track video interactions
export const trackVideoInteraction = (action: 'play' | 'pause' | 'complete', videoTitle: string, progress?: number) => {
  trackGAEvent(`video_${action}`, {
    event_category: 'video',
    event_label: videoTitle,
    value: progress,
    custom_parameter_1: action,
    user_engagement: 'video_interaction'
  });
};

// Track search interactions
export const trackSiteSearch = (searchTerm: string, resultsCount?: number) => {
  trackGAEvent('search', {
    event_category: 'site_search',
    event_label: searchTerm,
    value: resultsCount,
    custom_parameter_1: searchTerm,
    user_engagement: 'site_search'
  });
};

// Track user engagement milestones
export const trackEngagementMilestone = (milestone: string, value?: number) => {
  trackGAEvent('engagement_milestone', {
    event_category: 'engagement',
    event_label: milestone,
    value: value,
    session_engaged: true,
    user_engagement: milestone
  });
};

// Google Analytics page view tracking
export const trackGAPageView = (path: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-ZY3PG1S68G', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.href,
      send_page_view: true
    });
  }
};

// Enhanced event tracking with Google Analytics
export const trackEvent = (eventName: string, path?: string, additionalParams?: GAEventParams) => {
  // Track with Google Analytics
  trackGAEvent(eventName, {
    event_category: 'user_interaction',
    custom_parameter_1: path || eventName,
    user_engagement: 'user_interaction',
    ...additionalParams
  });
};

// Page view tracking with Google Analytics
export const trackPageView = (path: string, title?: string) => {
  // Track with Google Analytics
  trackGAPageView(path, title);