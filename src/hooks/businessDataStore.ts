import { supabase, CompleteBusinessData } from '../lib/supabase';

const BUSINESS_DATA_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedBusinessData: CompleteBusinessData | null = null;
let cachedBusinessDataAt = 0;
let pendingBusinessDataRequest: Promise<CompleteBusinessData | null> | null = null;

export const hasValidBusinessDataCache = (): boolean => {
  return !!cachedBusinessData && Date.now() - cachedBusinessDataAt < BUSINESS_DATA_CACHE_TTL_MS;
};

export const getCachedBusinessData = (): CompleteBusinessData | null => cachedBusinessData;

/**
 * Seed the in-memory cache with data we already have (e.g. the build-time
 * route loader payload) so the next consumer can read it without a round-trip.
 */
export const primeBusinessDataCache = (data: CompleteBusinessData): void => {
  cachedBusinessData = data;
  cachedBusinessDataAt = Date.now();
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

/**
 * Fetch the complete business data, served from the in-memory cache when fresh.
 * Concurrent callers share a single in-flight request so a page that mounts
 * many consumers only triggers one network wave.
 */
export const fetchBusinessData = (forceRefresh = false): Promise<CompleteBusinessData | null> => {
  if (!forceRefresh && hasValidBusinessDataCache()) {
    return Promise.resolve(cachedBusinessData);
  }

  if (forceRefresh || !pendingBusinessDataRequest) {
    pendingBusinessDataRequest = fetchBusinessDataFromSupabase().finally(() => {
      pendingBusinessDataRequest = null;
    });
  }

  return pendingBusinessDataRequest;
};
