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
  calendly: {
    hero: {
      source: 'website',
      medium: 'cta',
      campaign: 'hero_booking',
      content: 'hero_section'
    },
    services: {
      source: 'website',
      medium: 'cta',
      campaign: 'services_booking',
      content: 'services_section'
    },
    booking: {
      source: 'website',
      medium: 'cta',
      campaign: 'booking_section',
      content: 'main_booking_form'
    },
    footer: {
      source: 'website',
      medium: 'cta',
      campaign: 'footer_booking',
      content: 'footer_section'
    }
  },
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

// Helper function to get Calendly URL with UTM parameters
export const getCalendlyUrl = (location: keyof typeof UTM_CONFIGS.calendly): string => {
  const baseUrl = 'https://calendly.com/boxed2built/30min';
  const utmParams = UTM_CONFIGS.calendly[location];
  return createUTMUrl(baseUrl, utmParams);
};

// Helper function to get social media URLs with UTM parameters
export const getSocialUrl = (platform: keyof typeof UTM_CONFIGS.social, baseUrl: string): string => {
  const utmParams = UTM_CONFIGS.social[platform];
  return createUTMUrl(baseUrl, utmParams);
};

// Helper function to get Google review URL with UTM parameters
export const getGoogleReviewUrl = (): string => {
  const baseUrl = 'https://g.page/r/CW-qaf93r1ZuEAI/review';
  const utmParams = UTM_CONFIGS.reviews.google;
  return createUTMUrl(baseUrl, utmParams);
};