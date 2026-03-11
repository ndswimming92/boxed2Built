declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Enhanced event parameters interface with page context
export interface GAEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  page_location?: string;
  page_title?: string;
  user_engagement?: string;
  session_engaged?: boolean;
  engagement_time_msec?: number;

  // Enhanced page context parameters
  page_name?: string;
  page_section?: string;
  page_path?: string;

  // Element context parameters
  element_type?: string;
  element_location?: string;
  element_text?: string;

  // Action context parameters
  action_type?: string;
  action_value?: string;

  // Form-specific parameters
  form_name?: string;
  form_field?: string;
  form_step?: string;
  furniture_type?: string;
  number_of_pieces?: number;
  estimated_value?: string;

  // Conversion parameters
  conversion_type?: string;
  conversion_value?: number;
  currency?: string;
}

// Helper function to get page context from current URL
export const getPageContext = (): { page_name: string; page_path: string } => {
  if (typeof window === 'undefined') {
    return { page_name: 'unknown', page_path: '/' };
  }

  const path = window.location.pathname;
  const pageNames: Record<string, string> = {
    '/': 'home',
    '/about': 'about',
    '/services': 'services',
    '/partners': 'partners',
    '/gallery': 'gallery',
    '/contact': 'contact',
    '/privacy-policy': 'privacy_policy',
    '/terms-of-service': 'terms_of_service'
  };

  return {
    page_name: pageNames[path] || path.replace(/\//g, '_').replace(/^_/, '') || 'unknown',
    page_path: path
  };
}

export const trackGAEvent = (eventName: string, parameters?: GAEventParams) => {
  if (typeof window !== 'undefined' && window.gtag) {
    const pageContext = getPageContext();

    window.gtag('event', eventName, {
      event_category: parameters?.event_category || 'engagement',
      event_label: parameters?.event_label || eventName,
      page_location: window.location.href,
      page_title: document.title,
      page_name: pageContext.page_name,
      page_path: pageContext.page_path,
      ...parameters
    });
  }

};

export const trackConversion = (action: string, value?: number, currency: string = 'USD', additionalParams?: GAEventParams) => {
  if (typeof window !== 'undefined' && window.gtag) {
    const pageContext = getPageContext();

    window.gtag('event', 'conversion', {
      send_to: 'G-ZY3PG1S68G',
      event_category: 'conversion',
      event_label: action,
      value: value,
      currency: currency,
      page_location: window.location.href,
      page_title: document.title,
      page_name: pageContext.page_name,
      page_path: pageContext.page_path,
      conversion_type: action,
      conversion_value: value,
      ...additionalParams
    });
  }

};

// Track form interactions with enhanced parameters
export const trackFormInteraction = (
  formName: string,
  action: 'start' | 'complete' | 'abandon' | 'field_interaction' | 'validation_error',
  additionalParams?: GAEventParams
) => {
  trackGAEvent(`form_${action}`, {
    event_category: 'form_interaction',
    event_label: formName,
    form_name: formName,
    action_type: action,
    page_section: additionalParams?.page_section || 'form',
    element_type: 'form',
    user_engagement: 'form_interaction',
    ...additionalParams
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

// Track phone link clicks
export const trackPhoneLinkClick = (phoneNumber: string, linkText?: string) => {
  trackGAEvent('phone_link_click', {
    event_category: 'contact',
    event_label: phoneNumber,
    action_type: 'phone_click',
    action_value: phoneNumber,
    element_text: linkText,
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

// Enhanced event tracking with automatic page context
export const trackEvent = (eventName: string, pageSection?: string, additionalParams?: GAEventParams) => {
  trackGAEvent(eventName, {
    event_category: additionalParams?.event_category || 'user_interaction',
    event_label: additionalParams?.event_label || eventName,
    page_section: pageSection || additionalParams?.page_section || 'general',
    element_location: pageSection,
    action_type: eventName.split('-').pop() || 'click',
    user_engagement: 'user_interaction',
    ...additionalParams
  });
};

// Page view tracking with Google Analytics
export const trackPageView = (path: string, title?: string) => {
  // Track with Google Analytics
  trackGAPageView(path, title);
}
