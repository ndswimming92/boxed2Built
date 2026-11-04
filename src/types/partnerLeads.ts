/** What kind of business a lead is. Mirrors the check constraint on `category`. */
export type PartnerCategory =
  | 'moving'
  | 'apartments'
  | 'townhomes_hoa'
  | 'property_management'
  | 'realtor'
  | 'home_builder'
  | 'staging_design'
  | 'furniture_retail'
  | 'senior_living'
  | 'other';

/**
 * Where a lead stands. Mirrors the check constraint on `status`.
 * new            — not contacted yet.
 * contacted      — emailed; set by the send function on the first send.
 * talking        — they replied and a conversation is going.
 * partner        — a working referral partnership.
 * not_a_fit      — passed on. The send function refuses these.
 * do_not_contact — they asked not to be contacted. The send function refuses these.
 */
export type PartnerStatus = 'new' | 'contacted' | 'talking' | 'partner' | 'not_a_fit' | 'do_not_contact';

/** Another public page for the business: a Facebook page, a Google listing. */
export interface PartnerLink {
  label: string;
  url: string;
}

/** One row of `partner_leads`. */
export interface PartnerLead {
  id: string;
  organization_id: string;
  name: string;
  category: PartnerCategory;
  /** The town it is in ("Franklin, TN"). */
  location: string | null;
  summary: string;
  /** Why it would send customers Boxed2Built's way; one point per line. */
  why_fit: string;
  /** What a partnership with this business could look like; one point per line. */
  partnership_idea: string | null;
  website_url: string | null;
  /** The address the business publishes. Editable on the page. */
  email: string | null;
  /** The page the email was found on. */
  email_source_url: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  /** Written by an automated process, so the shape is checked before use. */
  links: unknown;
  draft_subject: string | null;
  draft_body: string | null;
  notes: string | null;
  status: PartnerStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  last_emailed_at: string | null;
  emails_sent: number;
  /** The coupon made for this partner, set by create_partner_lead_code. Absent until that migration runs. */
  coupon_id?: string | null;
  /** The Central-time day the daily run first saved it (YYYY-MM-DD). */
  found_on: string;
  created_at: string;
  updated_at: string;
}

/** One row of `partner_lead_emails`: an email exactly as it went out. */
export interface PartnerLeadEmail {
  id: string;
  lead_id: string;
  to_email: string;
  subject: string;
  body: string;
  resend_id: string | null;
  sent_by: string | null;
  sent_at: string;
}

/** What the browser may change on a lead. Everything else is the daily run's. */
export type PartnerLeadEdit = Partial<
  Pick<PartnerLead, 'status' | 'draft_subject' | 'draft_body' | 'email' | 'contact_name' | 'contact_title' | 'notes'>
>;

/** The send function's preview: the email exactly as it would go out. */
export interface OutreachPreview {
  to: string | null;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  blocked: boolean;
  recentlyEmailed: boolean;
  lastEmailedAt: string | null;
  postalAddressSet: boolean;
}

/** The coupon a partner hands out: customers they send get the discount. */
export interface PartnerCode {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  is_active: boolean;
  times_used: number;
  last_used_at: string | null;
}

/** One Resend event for a sent outreach email (get_partner_lead_email_activity). */
export interface PartnerEmailEvent {
  email_id: string;
  event_type: string;
  occurred_at: string;
  /** For a click, the link that was clicked. */
  link: string | null;
}
