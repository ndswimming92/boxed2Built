// Type definitions for the application

export interface ServiceItem {
  id: number;
  type: string;
  description: string;
  startingPrice: string;
  priceRange?: string;
  includedItems: string[];
}

export interface Review {
  id: number;
  author: string;
  text: string;
  rating: number;
  datePublished: string;
  source: string;
  googleReviewUrl?: string;
}

export interface FormInquiry {
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
}