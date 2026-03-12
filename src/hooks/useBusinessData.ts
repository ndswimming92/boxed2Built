import { useState, useEffect } from 'react';
import { supabase, CompleteBusinessData } from '../lib/supabase';
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

const BUSINESS_DATA_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedBusinessData: CompleteBusinessData | null = null;
let cachedBusinessDataAt = 0;
let pendingBusinessDataRequest: Promise<CompleteBusinessData | null> | null = null;

const hasValidBusinessDataCache = () => {
  return !!cachedBusinessData && Date.now() - cachedBusinessDataAt < BUSINESS_DATA_CACHE_TTL_MS;
};

const fetchBusinessDataFromSupabase = async (): Promise<CompleteBusinessData | null> => {
  const { data: businessInfo, error: infoError } = await supabase
    .from('business_info')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (infoError) throw infoError;

  if (!businessInfo) {
    cachedBusinessData = null;
    cachedBusinessDataAt = Date.now();
    return null;
  }

  const [
    { data: address },
    { data: serviceAreas },
    { data: services },
    { data: businessHours },
    { data: paymentMethods },
    { data: socialMedia },
    { data: reviews },
    { data: attributes }
  ] = await Promise.all([
    supabase
      .from('business_address')
      .select('*')
      .eq('business_id', businessInfo.id)
      .maybeSingle(),
    supabase
      .from('service_areas')
      .select('*')
      .eq('business_id', businessInfo.id)
      .eq('is_active', true)
      .order('priority', { ascending: true }),
    supabase
      .from('services')
      .select('*')
      .eq('business_id', businessInfo.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('business_hours')
      .select('*')
      .eq('business_id', businessInfo.id),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('business_id', businessInfo.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('social_media')
      .select('*')
      .eq('business_id', businessInfo.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('customer_reviews')
      .select('*')
      .eq('business_id', businessInfo.id)
      .eq('is_active', true)
      .order('date_published', { ascending: false }),
    supabase
      .from('business_attributes')
      .select('*')
      .eq('business_id', businessInfo.id)
  ]);

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortedBusinessHours = (businessHours || []).sort((a, b) => {
    return dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
  });

  const completeData: CompleteBusinessData = {
    info: businessInfo,
    address: address || null,
    serviceAreas: serviceAreas || [],
    services: services || [],
    businessHours: sortedBusinessHours,
    paymentMethods: paymentMethods || [],
    socialMedia: socialMedia || [],
    reviews: reviews || [],
    attributes: attributes || []
  };

  cachedBusinessData = completeData;
  cachedBusinessDataAt = Date.now();

  return completeData;
};

export const useBusinessData = (forceRefresh?: number) => {
  const [data, setData] = useState<CompleteBusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        if (!forceRefresh && hasValidBusinessDataCache()) {
          setData(cachedBusinessData);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        const shouldBypassCache = typeof forceRefresh === 'number';
        if (shouldBypassCache || !pendingBusinessDataRequest) {
          pendingBusinessDataRequest = fetchBusinessDataFromSupabase().finally(() => {
            pendingBusinessDataRequest = null;
          });
        }

        const completeData = await pendingBusinessDataRequest;
        setData(completeData);
        setError(null);
      } catch (err) {
        console.error('Error fetching business data:', err);
        setError(err as Error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [forceRefresh]);

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
    logo_url: 'https://boxed2built.com/black_boxed2built_logo.png',
    image_url: 'https://boxed2built.com/black_boxed2built_logo.png',
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
    day_of_week: hours.dayOfWeek,
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
