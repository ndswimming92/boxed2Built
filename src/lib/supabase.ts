// supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getRequestTraceContext } from '../utils/telemetry';

/** ────────────────────────────────────────────────────────────────────────────
 *  Environment & Client (public website settings)
 *  - No session persistence (public reads only)
 *  - No auto token refresh
 *  - Narrow global headers if you later add RLS audiences, etc.
 *  -------------------------------------------------------------------------- */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// During SSG/SSR there is no browser context, so auth storage must be disabled
// to prevent localStorage access in Node.js. The missing-env case is also safe:
// createClient with empty strings produces a client that fails on network calls
// but never throws at module load — all callers already handle fetch failures.
const isBrowser = typeof window !== 'undefined';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    flowType: 'pkce',
    storageKey: 'boxed2built.auth.token',
  },
  global: {
    fetch: async (input, init) => {
      const traceContext = getRequestTraceContext();
      const headers = new Headers(init?.headers || {});
      headers.set('x-correlation-id', traceContext.correlationId);
      headers.set('x-session-correlation-id', traceContext.sessionCorrelationId);

      return fetch(input, {
        ...init,
        headers,
      });
    },
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
  total_client_hours_saved: number | null;
  hours_counter_duration_ms: number | null;
  hours_counter_frame_ms: number | null;
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
  category?: string | null;
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
  show_in_header: boolean;
  job_completion_id: string | null;
  source: string;
  collected_at_completion: boolean;
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

export type JobStatus = 'quoted' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'lost' | 'cancelled';

export type LostReasonCategory =
  | 'Price too high'
  | 'Went with competitor'
  | 'Customer decided not to proceed'
  | 'Timeline didn\'t work'
  | 'Customer unresponsive'
  | 'Out of service area'
  | 'Project scope mismatch'
  | 'Other';

export type Job = {
  id: string;
  business_id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  /** Customer address, kept in sync with the linked client profile. */
  client_address: string | null;
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
  /** Where the work took place. null means the same as client_address. */
  service_address: string | null;
  payment_method: string | null;
  payment_date: string | null;
  reviews_received: boolean;
  google_review_link_sent: boolean;
  repeat_client: boolean;
  referral_source: string | null;
  notes: string | null;
  completion_id: string | null;
  has_signature: boolean;
  signed_off_at: string | null;
  total_mileage: number | null;
  mileage_deduction: number | null;
  job_status: JobStatus;
  lost_reason_category: LostReasonCategory | null;
  lost_reason_notes: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  is_free: boolean;
  client_type: 'residential' | 'business' | null;
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
  client_id: string | null;
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
  first_responded_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_source: string | null;
  confirmation_code?: string | null;
  furniture_photo_url: string | null;
  furniture_image_path: string | null;
  client_type: 'residential' | 'business' | null;
  is_test: boolean;
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
  furniture_photo_url: string | null;
  furniture_image_path: string | null;
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

export type InvoiceSettings = {
  id: string;
  business_id: string;
  invoice_prefix: string;
  next_invoice_number: number;
  default_payment_terms: string;
  default_due_days: number;
  default_tax_rate: number;
  enable_late_fees: boolean;
  late_fee_grace_days: number;
  late_fee_type: 'fixed' | 'percentage';
  late_fee_amount: number;
  invoice_notes_template: string | null;
  invoice_footer: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  business_id: string;
  organization_id: string;
  client_id: string | null;
  inquiry_id: string | null;
  job_id: string | null;
  invoice_number: string;
  invoice_type: 'estimate' | 'deposit' | 'progress' | 'final' | 'general';
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_address: string | null;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  tax_override: boolean;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  internal_notes: string | null;
  payment_terms_description: string | null;
  late_fee_enabled: boolean;
  late_fee_type: 'fixed' | 'percentage' | null;
  late_fee_amount: number | null;
  late_fee_grace_days: number | null;
  late_fee_charged: number;
  sent_at: string | null;
  paid_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  item_type: 'labor' | 'material' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  is_taxable: boolean;
  total: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  payment_reference: string | null;
  notes: string | null;
  recorded_by: string | null;
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

export type Goal = {
  id: string;
  business_id: string;
  title: string;
  description: string;
  category: 'financial' | 'operational' | 'growth' | 'customer_satisfaction' | 'custom';
  priority: 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  target_value: number;
  current_value: number;
  unit_type: 'revenue' | 'jobs' | 'hours' | 'percentage' | 'custom';
  unit_label: string | null;
  start_date: string | null;
  due_date: string | null;
  completion_date: string | null;
  progress_percentage: number;
  is_archived: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QRCode = {
  id: string;
  business_id: string;
  slug: string;
  title: string;
  description: string;
  default_destination_url: string;
  status: 'active' | 'inactive';
  notify_on_scan: boolean;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
};

export type QRCodeSchedule = {
  id: string;
  qr_code_id: string;
  destination_url: string;
  start_datetime: string;
  end_datetime: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type QRCodeWithSchedules = QRCode & {
  schedules: QRCodeSchedule[];
};

export type QRScan = {
  id: string;
  qr_code_id: string;
  scanned_at: string;
  user_agent: string;
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_model: string;
  screen_resolution: string;
  language: string;
  timezone: string;
  referrer: string;
  destination_url: string;
  ip_address: string;
  country: string;
  region: string;
  city: string;
  is_bot: boolean;
  notification_sent_at: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
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

export type JobCompletion = {
  id: string;
  job_id: string;
  completed_at: string;
  completed_by: string | null;
  signature_data: string;
  signature_url: string | null;
  completion_checklist: Record<string, any>;
  completion_photos: string[];
  admin_notes: string;
  device_info: Record<string, any>;
  customer_name: string;
  final_price: number | null;
  is_customer_satisfied: boolean;
  location_captured: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type JobCompletionReminder = {
  id: string;
  job_completion_id: string | null;
  job_id: string;
  reminder_type: 'follow_up_call' | 'warranty_check' | 'repeat_business' | 'custom';
  scheduled_date: string;
  status: 'pending' | 'completed' | 'dismissed' | 'snoozed';
  completed_at: string | null;
  snoozed_until: string | null;
  admin_notes: string;
  outcome_notes: string;
  created_by: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseCategory = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  irs_category: string | null;
  is_tax_deductible: boolean;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessExpense = {
  id: string;
  business_id: string;
  category_id: string | null;
  expense_date: string;
  vendor_name: string;
  description: string;
  amount: number;
  payment_method: string | null;
  confirmation_number: string | null;
  is_tax_deductible: boolean;
  deductible_amount: number | null;
  tax_year: number;
  quarter: number | null;
  receipt_url: string | null;
  has_receipt: boolean;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  tags: string[] | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Contractor = {
  id: string;
  business_id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type JobContractor = {
  id: string;
  business_id: string;
  organization_id: string;
  job_id: string;
  contractor_id: string;
  amount_paid: number;
  work_description: string | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type JobContractorWithContractor = JobContractor & {
  contractor?: Contractor | null;
};

export type GPSCoordinate = {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
};

export type LocationData = {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
};

export type MileageSettings = {
  id: string;
  business_id: string;
  effective_date: string;
  rate_per_mile: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TrackingState = {
  isTracking: boolean;
  startTime: Date | null;
  currentDistance: number;
  waypoints: GPSCoordinate[];
  watchId: number | null;
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
  total_client_hours_saved: z.number().nullable(),
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
  show_in_header: z.boolean(),
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
    'id,name,alternate_name,description,slogan,phone,email,website,founded_year,founder_name,price_range,currencies_accepted,logo_url,image_url,total_client_hours_saved,is_active,created_at,updated_at',
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
    'id,business_id,author_name,review_body,rating_value,date_published,is_featured,is_verified,is_active,show_in_header,created_at,updated_at',
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
  serviceAreas.forEach((x) => zServiceArea.parse(x));
  services.forEach((x) => zService.parse(x));
  businessHours.forEach((x) => zBusinessHours.parse(x));
  paymentMethods.forEach((x) => zPaymentMethod.parse(x));
  socialMedia.forEach((x) => zSocialMedia.parse(x));
  reviews.forEach((x) => zCustomerReview.parse(x));
  attributes.forEach((x) => zBusinessAttribute.parse(x));

  const payload: CompleteBusinessData = {
    info: info as BusinessInfo,
    address,
    serviceAreas,
    services,
    businessHours,
    paymentMethods,
    socialMedia,
    reviews: reviews as CustomerReview[],
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
