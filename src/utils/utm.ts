// UTM parameter utility functions for tracking
export interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export const createUTMUrl = (baseUrl: string, params: UTMParams): string => {
  const url = new URL(baseUrl);
  
  url.searchParams.set('utm_source', params.source);
  url.searchParams.set('utm_medium', params.medium);
  url.searchParams.set('utm_campaign', params.campaign);
  
  if (params.content) {
    url.searchParams.set('utm_content', params.content);
  }
  
  if (params.term) {
    url.searchParams.set('utm_term', params.term);
  }
  
  return url.toString();
};

// Predefined UTM configurations for common links
export const UTM_CONFIGS = {
  social: {
    facebook: {
      source: 'website',
      medium: 'social',
      campaign: 'social_media',
      content: 'facebook_link'
    },
    instagram: {
      source: 'website',
      medium: 'social',
      campaign: 'social_media',
      content: 'instagram_link'
    },
    youtube: {
      source: 'website',
      medium: 'social',
      campaign: 'social_media',
      content: 'youtube_link'
    }
  },
  reviews: {
    google: {
      source: 'website',
      medium: 'review',
      campaign: 'google_reviews',
      content: 'footer_review_link'
    }
  }
};

// Helper function to get social media URLs with UTM parameters
export const getSocialUrl = (platform: string, baseUrl: string): string => {
  const key = platform.toLowerCase().replace(/\s+/g, '') as keyof typeof UTM_CONFIGS.social;
  const utmParams = UTM_CONFIGS.social[key];
  if (!utmParams) {
    return createUTMUrl(baseUrl, {
      source: 'website',
      medium: 'social',
      campaign: 'social_media',
      content: `${key}_link`,
    });
  }
  return createUTMUrl(baseUrl, utmParams);
};

// Helper function to get Google review URL with UTM parameters
export const getGoogleReviewUrl = (): string => {
  const baseUrl = 'https://g.page/r/CW-qaf93r1ZuEAI/review';
  const utmParams = UTM_CONFIGS.reviews.google;
  return createUTMUrl(baseUrl, utmParams);
};

export const INVOICE_UTM_BASE = {
  source: 'invoice',
  medium: 'invoice',
  campaign: 'invoice_payment',
};

export const getInvoiceExternalUrl = (baseUrl: string, content: string): string => {
  return createUTMUrl(baseUrl, { ...INVOICE_UTM_BASE, content });
};

export const getInvoiceInternalSearch = (content: string): string => {
  return `?utm_source=invoice&utm_medium=invoice&utm_campaign=invoice_payment&utm_content=${content}`;
};

export const trackInvoiceClick = (type: 'phone' | 'email', label: string): void => {
  if (typeof window !== 'undefined' && typeof (window as Window & { gtag?: Function }).gtag === 'function') {
    (window as Window & { gtag: Function }).gtag('event', `invoice_${type}_click`, {
      event_category: 'invoice',
      event_label: label,
    });
  }
};