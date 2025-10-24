import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  category: string | null;
  base_price: number;
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
  day_of_week: string;
  opens: string | null;
  closes: string | null;
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
  rating_value: number;
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
