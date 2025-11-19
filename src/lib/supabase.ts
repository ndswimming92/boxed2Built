// supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** ────────────────────────────────────────────────────────────────────────────
 *  Environment & Client (public website settings)
 *  - No session persistence (public reads only)
 *  - No auto token refresh
 *  - Narrow global headers if you later add RLS audiences, etc.
 *  -------------------------------------------------------------------------- */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  // db: { schema: 'public' }, // uncomment if you use a non-default schema
});

/** ────────────────────────────────────────────────────────────────────────────
 *  Domain Types (TS) — keep these in sync with DB schema
 *  -------------------------------------------------------------------------- */
export type BusinessInfo = {
  id: string;
  name: string;
  alternate_name: string | null;
  description: string;
  slogan: string | null;
  phone: string;
  email: string;
  website: string;
  founded_year: string | null;
  founder_name: string | null;
  price_range: string | null;
  currencies_accepted: string;
  logo_url: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessAddress = {
  id: string;
  business_id: string;
  street_address: string;
  address_locality: string;
  address_region: string;
  postal_code: string | null;
  address_country: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

export type ServiceArea = {
  id: string;
  business_id: string;
  city_name: string;
  region: string;
  country: string;
  postal_codes: string[] | null;
  latitude: number | null;
  longitude: number | null;
  radius_miles: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  base_price: number;
  min_price: number | null;
  max_price: number | null;
  price_range_description: string | null;
  included_items: string[] | null;
  price_currency: string;
  duration_minutes: number | null;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessHours = {
  id: string;
  business_id: string;
  day_of_week: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | string; // relax if needed
  opens: string | null;   // '09:00'
  closes: string | null;  // '17:00'
  is_closed: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = {
  id: string;
  business_id: string;
  method_name: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type SocialMedia = {
  id: string;
  business_id: string;
  platform: string;
  profile_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type CustomerReview = {
  id: string;
  business_id: string;
  author_name: string;
  review_body: string;
  rating_value: number; // 1–5
  date_published: string;
  is_featured: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessAttribute = {
  id: string;
  business_id: string;
  attribute_name: string;
  attribute_value: string;
  created_at: string;
};

export type GalleryItem = {
  id: string;
  business_id: string;
  type: 'image' | 'video';
  src: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  alt: string | null;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date: string | null;
  location: string | null;
  width: number | null;
  height: number | null;
  amazon_link: string | null;
  platform: 'youtube' | 'vimeo' | 'direct' | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  business_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  job_type: string | null;
  job_description: string | null;
  date_quoted: string | null;
  date_scheduled: string | null;
  date_completed: string | null;
  hours_worked: number | null;
  quoted_price: number | null;
  final_price: number | null;
  materials_cost: number | null;
  location_city: string | null;
  payment_method: string | null;
  payment_date: string | null;
  reviews_received: boolean;
  google_review_link_sent: boolean;
  repeat_client: boolean;
  referral_source: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FormInquiry = {
  id: string;
  business_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  furniture_type: string;
  pieces: number;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  notes: string | null;
  user_city: string | null;
  estimated_price: string | null;
  estimated_time: string | null;
  submission_date: string;
  status: 'pending' | 'converted_to_job' | 'archived';
  source: string;
  viewed: boolean;
  converted_job_id: string | null;
  last_contact_date: string | null;
  contact_method: string | null;
  contact_notes: string | null;
  response_count: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedRequest = {
  id: string;
  business_id: string;
  inquiry_id: string | null;
  confirmation_code: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  furniture_type: string;
  pieces: number;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  notes: string | null;
  user_city: string | null;
  estimated_price: string | null;
  estimated_time: string | null;
  submission_date: string;
  last_accessed: string | null;
  access_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationBar = {
  id: string;
  business_id: string;
  message: string;
  background_color: string;
  text_color: string;
  is_enabled: boolean;
  enable_scroll_animation: boolean;
  scroll_speed: 'slow' | 'medium' | 'fast';
  created_at: string;
  updated_at: string;
};

export type TaxSettings = {
  id: string;
  business_id: string;
  filing_status: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  use_standard_deduction: boolean;
  estimated_itemized_deductions: number;
  estimated_annual_business_expenses: number;
  q1_payment_goal: number;
  q2_payment_goal: number;
  q3_payment_goal: number;
  q4_payment_goal: number;
  include_health_insurance_deduction: boolean;
  health_insurance_annual_cost: number;
  include_retirement_contributions: boolean;
  retirement_contribution_annual: number;
  state: string;
  tax_year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QuarterlyTaxPayment = {
  id: string;
  business_id: string;
  tax_year: number;
  quarter: number;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
  confirmation_number: string | null;
  federal_income_tax_amount: number;
  self_employment_tax_amount: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TaxCalculation = {
  id: string;
  business_id: string;
  calculation_date: string;
  tax_year: number;
  quarter: number | null;
  gross_income: number;
  total_expenses: number;
  net_profit: number;
  self_employment_tax: number;
  self_employment_deduction: number;
  adjusted_gross_income: number;
  standard_or_itemized_deduction: number;
  taxable_income: number;
  federal_income_tax: number;
  total_tax_liability: number;
  quarterly_payments_made: number;
  estimated_tax_remaining: number;
  effective_tax_rate: number;
  marginal_tax_bracket: number;
  recommended_withholding_percentage: number;
  calculation_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompleteBusinessData = {
  info: BusinessInfo;
  address: BusinessAddress | null;
  serviceAreas: ServiceArea[];
  services: Service[];
  businessHours: BusinessHours[];
  paymentMethods: PaymentMethod[];
  socialMedia: SocialMedia[];
  reviews: CustomerReview[];
  attributes: BusinessAttribute[];
};

/** ────────────────────────────────────────────────────────────────────────────
 *  Runtime Validation (Zod) — catches silent schema drift in production
 *  - Optional: relax/extend as your schema evolves
 *  -------------------------------------------------------------------------- */
const zBusinessInfo = z.object({
  id: z.string(),
  name: z.string(),
  alternate_name: z.string().nullable(),
  description: z.string(),
  slogan: z.string().nullable(),
  phone: z.string(),
  email: z.string(),
  website: z.string(),
  founded_year: z.string().nullable(),
  founder_name: z.string().nullable(),
  price_range: z.string().nullable(),
  currencies_accepted: z.string(),
  logo_url: z.string().nullable(),
  image_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zBusinessAddress = z.object({
  id: z.string(),
  business_id: z.string(),
  street_address: z.string(),
  address_locality: z.string(),
  address_region: z.string(),
  postal_code: z.string().nullable(),
  address_country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zServiceArea = z.object({
  id: z.string(),
  business_id: z.string(),
  city_name: z.string(),
  region: z.string(),
  country: z.string(),
  postal_codes: z.array(z.string()).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  radius_miles: z.number(),
  priority: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zService = z.object({
  id: z.string(),
  business_id: z.string(),
  name: z.string(),
  description: z.string(),
  base_price: z.number(),
  min_price: z.number().nullable(),
  max_price: z.number().nullable(),
  price_range_description: z.string().nullable(),
  included_items: z.array(z.string()).nullable(),
  price_currency: z.string(),
  duration_minutes: z.number().nullable(),
  is_featured: z.boolean(),
  display_order: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zBusinessHours = z.object({
  id: z.string(),
  business_id: z.string(),
  day_of_week: z.string(),
  opens: z.string().nullable(),
  closes: z.string().nullable(),
  is_closed: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zPaymentMethod = z.object({
  id: z.string(),
  business_id: z.string(),
  method_name: z.string(),
  is_active: z.boolean(),
  display_order: z.number(),
  created_at: z.string(),
});

const zSocialMedia = z.object({
  id: z.string(),
  business_id: z.string(),
  platform: z.string(),
  profile_url: z.string(),
  is_active: z.boolean(),
  display_order: z.number(),
  created_at: z.string(),
});

const zCustomerReview = z.object({
  id: z.string(),
  business_id: z.string(),
  author_name: z.string(),
  review_body: z.string(),
  rating_value: z.number().min(1).max(5),
  date_published: z.string(),
  is_featured: z.boolean(),
  is_verified: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const zBusinessAttribute = z.object({
  id: z.string(),
  business_id: z.string(),
  attribute_name: z.string(),
  attribute_value: z.string(),
  created_at: z.string(),
});

const zNotificationBar = z.object({
  id: z.string(),
  business_id: z.string(),
  message: z.string(),
  background_color: z.string(),
  text_color: z.string(),
  is_enabled: z.boolean(),
  enable_scroll_animation: z.boolean(),
  scroll_speed: z.enum(['slow', 'medium', 'fast']),
  created_at: z.string(),
  updated_at: z.string(),
});

/** ────────────────────────────────────────────────────────────────────────────
 *  Table & Column helpers (centralize names + narrow selects)
 *  -------------------------------------------------------------------------- */
const T = {
  business_info: 'business_info',
  business_addresses: 'business_addresses',
  service_areas: 'service_areas',
  services: 'services',
  business_hours: 'business_hours',
  payment_methods: 'payment_methods',
  social_media: 'social_media',
  customer_reviews: 'customer_reviews',
  business_attributes: 'business_attributes',
  notification_bar: 'notification_bar',
} as const;

const COLS = {
  info:
    'id,name,alternate_name,description,slogan,phone,email,website,founded_year,founder_name,price_range,currencies_accepted,logo_url,image_url,is_active,created_at,updated_at',
  address:
    'id,business_id,street_address,address_locality,address_region,postal_code,address_country,latitude,longitude,created_at,updated_at',
  serviceArea:
    'id,business_id,city_name,region,country,postal_codes,latitude,longitude,radius_miles,priority,is_active,created_at,updated_at',
  service:
    'id,business_id,name,description,base_price,min_price,max_price,price_range_description,included_items,price_currency,duration_minutes,is_featured,display_order,is_active,created_at,updated_at',
  hours:
    'id,business_id,day_of_week,opens,closes,is_closed,created_at,updated_at',
  payment:
    'id,business_id,method_name,is_active,display_order,created_at',
  social:
    'id,business_id,platform,profile_url,is_active,display_order,created_at',
  review:
    'id,business_id,author_name,review_body,rating_value,date_published,is_featured,is_verified,is_active,created_at,updated_at',
  attribute:
    'id,business_id,attribute_name,attribute_value,created_at',
  notificationBar:
    'id,business_id,message,background_color,text_color,is_enabled,enable_scroll_animation,scroll_speed,created_at,updated_at',
} as const;

/** ────────────────────────────────────────────────────────────────────────────
 *  Small Error Helper
 *  -------------------------------------------------------------------------- */
function assertNoError<T>(data: T, error: { message?: string } | null, ctx: string): T {
  if (error) throw new Error(`${ctx}: ${error.message ?? 'Unknown Supabase error'}`);
  if (data == null) throw new Error(`${ctx}: No data`);
  return data;
}

/** ────────────────────────────────────────────────────────────────────────────
 *  In-memory cache (simple SWR style)
 *  -------------------------------------------------------------------------- */
let _cache: { payload: CompleteBusinessData; ts: number } | null = null;
const REVALIDATE_MS = 60_000; // 1 minute; tweak as needed

/** ────────────────────────────────────────────────────────────────────────────
 *  Public API: Fetch the full business data in parallel
 *  - Filters to is_active where appropriate
 *  - Validates at runtime with Zod (optional but recommended)
 *  -------------------------------------------------------------------------- */
export async function getCompleteBusiness(): Promise<CompleteBusinessData> {
  const now = Date.now();
  if (_cache && now - _cache.ts < REVALIDATE_MS) return _cache.payload;

  const [
    infoRes,
    addrRes,
    areasRes,
    servicesRes,
    hoursRes,
    paymentsRes,
    socialsRes,
    reviewsRes,
    attrsRes,
  ] = await Promise.all([
    supabase.from(T.business_info).select(COLS.info).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from(T.business_addresses).select(COLS.address).limit(1).maybeSingle(),
    supabase.from(T.service_areas).select(COLS.serviceArea).eq('is_active', true).order('priority', { ascending: false }),
    supabase.from(T.services).select(COLS.service).eq('is_active', true).order('display_order', { ascending: true }),
    supabase.from(T.business_hours).select(COLS.hours).order('day_of_week', { ascending: true }),
    supabase.from(T.payment_methods).select(COLS.payment).eq('is_active', true).order('display_order', { ascending: true }),
    supabase.from(T.social_media).select(COLS.social).eq('is_active', true).order('display_order', { ascending: true }),
    supabase.from(T.customer_reviews).select(COLS.review).eq('is_active', true).order('is_featured', { ascending: false }),
    supabase.from(T.business_attributes).select(COLS.attribute),
  ]);

  const info = assertNoError(infoRes.data, infoRes.error, 'Fetch business_info');
  const address = addrRes.error ? null : addrRes.data ?? null;

  const serviceAreas = assertNoError(areasRes.data ?? [], areasRes.error, 'Fetch service_areas');
  const services = assertNoError(servicesRes.data ?? [], servicesRes.error, 'Fetch services');
  const businessHours = assertNoError(hoursRes.data ?? [], hoursRes.error, 'Fetch business_hours');
  const paymentMethods = assertNoError(paymentsRes.data ?? [], paymentsRes.error, 'Fetch payment_methods');
  const socialMedia = assertNoError(socialsRes.data ?? [], socialsRes.error, 'Fetch social_media');
  const reviews = assertNoError(reviewsRes.data ?? [], reviewsRes.error, 'Fetch customer_reviews');
  const attributes = assertNoError(attrsRes.data ?? [], attrsRes.error, 'Fetch business_attributes');

  // Runtime validation (throws if schema drift)
  zBusinessInfo.parse(info);
  if (address) zBusinessAddress.parse(address);
  serviceAreas.forEach(zServiceArea.parse);
  services.forEach(zService.parse);
  businessHours.forEach(zBusinessHours.parse);
  paymentMethods.forEach(zPaymentMethod.parse);
  socialMedia.forEach(zSocialMedia.parse);
  reviews.forEach(zCustomerReview.parse);
  attributes.forEach(zBusinessAttribute.parse);

  const payload: CompleteBusinessData = {
    info,
    address,
    serviceAreas,
    services,
    businessHours,
    paymentMethods,
    socialMedia,
    reviews,
    attributes,
  };

  _cache = { payload, ts: now };
  return payload;
}

/** ────────────────────────────────────────────────────────────────────────────
 *  Extra niceties you can use elsewhere
 *  -------------------------------------------------------------------------- */

/** Simple keyword search across active services */
export async function searchServices(q: string): Promise<Service[]> {
  if (!q || q.trim().length < 2) return [];
  const { data, error } = await supabase
    .from(T.services)
    .select(COLS.service)
    .eq('is_active', true)
    // If you added a generated tsvector col "search" use .textSearch('search', q)
    .ilike('name', `%${q}%`);

  return assertNoError<Service[]>(data ?? [], error, 'Search services');
}

/** Clear in-memory cache — call after admin edits or when forcing refresh */
export function invalidateBusinessCache() {
  _cache = null;
}

/** Fetch the active notification bar for a business */
export async function getNotificationBar(businessId: string): Promise<NotificationBar | null> {
  const { data, error } = await supabase
    .from(T.notification_bar)
    .select(COLS.notificationBar)
    .eq('business_id', businessId)
    .eq('is_enabled', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching notification bar:', error);
    return null;
  }

  if (data) {
    zNotificationBar.parse(data);
  }

  return data;
}

/** Fetch notification bar settings for admin (regardless of enabled status) */
export async function getNotificationBarSettings(businessId: string): Promise<NotificationBar | null> {
  const { data, error } = await supabase
    .from(T.notification_bar)
    .select(COLS.notificationBar)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching notification bar settings:', error);
    return null;
  }

  if (data) {
    zNotificationBar.parse(data);
  }

  return data;
}
