import { useState, useEffect } from 'react';
import { CompleteBusinessData } from '../lib/supabase';
import { fetchBusinessData } from './businessDataStore';
import { useBusinessDataContext } from '../contexts/BusinessDataContext';
import {
  BUSINESS_INFO,
  ADDRESS_INFO,
  SERVICE_AREAS,
  PRIMARY_SERVICES,
  BUSINESS_HOURS,
  PAYMENT_METHODS,
  SOCIAL_MEDIA_URLS,
  CUSTOMER_REVIEWS
} from '../constants/localSEO';

export const useBusinessData = (forceRefresh?: number) => {
  // When a BusinessDataProvider is mounted (public routes), read the shared
  // data instead of issuing a duplicate fetch wave per consumer.
  const sharedData = useBusinessDataContext();

  const [data, setData] = useState<CompleteBusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // The provider owns fetching when present; nothing to do here.
    if (sharedData) return;

    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        const completeData = await fetchBusinessData(typeof forceRefresh === 'number');
        if (!active) return;
        setData(completeData);
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error('Error fetching business data:', err);
        setError(err as Error);
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [forceRefresh, sharedData]);

  if (sharedData) {
    return { data: sharedData.data, loading: sharedData.loading, error: sharedData.error };
  }

  return { data, loading, error };
};

const buildFallbackData = (): CompleteBusinessData => ({
  info: {
    id: 'fallback',
    name: BUSINESS_INFO.name,
    alternate_name: `${BUSINESS_INFO.name} Furniture Assembly`,
    description: 'Professional furniture assembly and handyman services in Spring Hill, TN. Expert IKEA, Target, Walmart assembly.',
    slogan: BUSINESS_INFO.slogan,
    phone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    website: BUSINESS_INFO.website,
    founded_year: BUSINESS_INFO.yearEstablished,
    founder_name: BUSINESS_INFO.founder,
    price_range: BUSINESS_INFO.priceRange,
    currencies_accepted: 'USD',
    logo_url: 'https://boxed2built.com/boxed2built_logo.png',
    image_url: 'https://boxed2built.com/boxed2built_logo.png',
    total_client_hours_saved: 0,
    hours_counter_duration_ms: null,
    hours_counter_frame_ms: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  address: {
    id: 'fallback',
    business_id: 'fallback',
    street_address: ADDRESS_INFO.streetAddress,
    address_locality: ADDRESS_INFO.addressLocality,
    address_region: ADDRESS_INFO.addressRegion,
    postal_code: ADDRESS_INFO.postalCode,
    address_country: ADDRESS_INFO.addressCountry,
    latitude: parseFloat(ADDRESS_INFO.coordinates.latitude),
    longitude: parseFloat(ADDRESS_INFO.coordinates.longitude),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  serviceAreas: SERVICE_AREAS.map((area, index) => ({
    id: `fallback-${index}`,
    business_id: 'fallback',
    city_name: area.split(',')[0].trim(),
    region: 'TN',
    country: 'US',
    postal_codes: null,
    latitude: null,
    longitude: null,
    radius_miles: 15,
    priority: index + 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })),
  services: PRIMARY_SERVICES.map((service, index) => ({
    id: `fallback-${index}`,
    business_id: 'fallback',
    name: service.name,
    description: service.description,
    category: 'Furniture Assembly',
    base_price: parseFloat(service.price),
    min_price: null,
    max_price: null,
    price_range_description: null,
    included_items: null,
    price_currency: 'USD',
    duration_minutes: null,
    is_featured: index < 5,
    display_order: index,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })),
  businessHours: BUSINESS_HOURS.structured.map((hours, index) => ({
    id: `fallback-${index}`,
    business_id: 'fallback',
    day_of_week: Array.isArray(hours.dayOfWeek) ? hours.dayOfWeek.join(', ') : hours.dayOfWeek,
    opens: hours.opens,
    closes: hours.closes,
    is_closed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })),
  paymentMethods: PAYMENT_METHODS.map((method, index) => ({
    id: `fallback-${index}`,
    business_id: 'fallback',
    method_name: method,
    is_active: true,
    display_order: index,
    created_at: new Date().toISOString()
  })),
  socialMedia: SOCIAL_MEDIA_URLS.map((url, index) => {
    let platform = 'Unknown';
    if (url.includes('facebook')) platform = 'Facebook';
    if (url.includes('instagram')) platform = 'Instagram';
    if (url.includes('youtube')) platform = 'YouTube';

    return {
      id: `fallback-${index}`,
      business_id: 'fallback',
      platform,
      profile_url: url,
      is_active: true,
      display_order: index,
      created_at: new Date().toISOString()
    };
  }),
  reviews: CUSTOMER_REVIEWS.map((review, index) => ({
    id: `fallback-${index}`,
    business_id: 'fallback',
    author_name: review.author,
    review_body: review.reviewBody,
    rating_value: review.ratingValue,
    date_published: review.datePublished,
    is_featured: index < 3,
    is_verified: true,
    show_in_header: false,
    job_completion_id: null,
    source: 'manual',
    collected_at_completion: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })),
  attributes: []
});

export const useBusinessDataWithFallback = () => {
  const { data, loading, error } = useBusinessData();

  if (loading) {
    return { data: buildFallbackData(), loading: false, error: null, isFallback: true };
  }

  if (error || !data) {
    return { data: buildFallbackData(), loading: false, error, isFallback: true };
  }

  return { data, loading: false, error: null, isFallback: false };
};
