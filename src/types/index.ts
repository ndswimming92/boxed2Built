// Type definitions for the application

export type OrganizationRole = 'viewer' | 'member' | 'admin' | 'owner';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  invited_at: string;
  joined_at: string;
  is_active: boolean;
  user?: {
    email: string;
    id: string;
  };
}

export interface UserOrganizationContext {
  organization: Organization;
  role: OrganizationRole;
  is_active: boolean;
}

export interface ServiceItem {
  priceRange?: string;
  id: number;
  type: string;
  description: string;
  startingPrice: string;
  includedItems: string[];
}

export interface Review {
  id: string | number;
  author: string;
  text: string;
  rating: number;
  datePublished: string;
  source: string;
  googleReviewUrl?: string;
  /** Author initials shown in the card avatar (e.g. "VG"). */
  initials?: string;
  /** Avatar color register — cycles through the brand tints. */
  tint?: 'blue' | 'green' | 'emerald';
}

export interface FormInquiry {
  id: string;
  business_id: string;
  organization_id: string;
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
  referral_code_used: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}