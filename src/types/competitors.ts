/**
 * What kind of competitor this is. Mirrors the check constraint on `category`.
 * local       — an assembly business serving the same area.
 * platform    — a national marketplace or app that takes assembly jobs here.
 * retailer    — a store's own assembly service, sold at checkout.
 * out_of_area — a standout business elsewhere, kept for ideas only.
 */
export type CompetitorCategory = 'local' | 'platform' | 'retailer' | 'out_of_area';

/** Whether the business is still trading, as the weekly run last saw it. */
export type CompetitorOperatingStatus = 'operating' | 'closed';

/** Another public page for a competitor: a Facebook page, a Google listing. */
export interface CompetitorLink {
  label: string;
  url: string;
}

/** One row of `competitors`, written by the weekly competitor watch. */
export interface Competitor {
  id: string;
  organization_id: string;
  name: string;
  category: CompetitorCategory;
  operating_status: CompetitorOperatingStatus;
  /** Where it is based ("Franklin, TN") or "Nationwide". */
  location: string | null;
  /** One or two sentences on who they are. */
  summary: string;
  website_url: string | null;
  /** The owner or founder, as the business itself names them. */
  owner_name: string | null;
  /** The business's published contact email. */
  email: string | null;
  phone: string | null;
  service_area: string | null;
  /** The list fields below are written one point per line. */
  services: string | null;
  pricing: string | null;
  /** How customers book and pay. */
  booking: string | null;
  /** What they do that stands out. */
  standout: string | null;
  reviews: string | null;
  other_notes: string | null;
  /** Written by an automated process, so the shape is checked before use. */
  links: unknown;
  /** The last day the weekly run confirmed these details (YYYY-MM-DD). */
  last_verified_on: string;
  /** Set when the owner says this is not a competitor. */
  removed_at: string | null;
  removed_by: string | null;
  created_at: string;
  updated_at: string;
}

/** What an action item is about. Mirrors the check constraint on `category`. */
export type ActionItemCategory =
  | 'services'
  | 'pricing'
  | 'booking'
  | 'marketing'
  | 'trust'
  | 'customer_experience'
  | 'other';

export type ActionItemPriority = 'high' | 'medium' | 'low';

/** quick — an hour or two. moderate — a day or a weekend. big — a project. */
export type ActionItemEffort = 'quick' | 'moderate' | 'big';

/**
 * open      — still to look at.
 * done      — ticked off.
 * dismissed — removed as not relevant. Kept so it is not suggested again.
 */
export type ActionItemStatus = 'open' | 'done' | 'dismissed';

/** One row of `competitor_action_items`: something competitors do that Boxed2Built does not yet. */
export interface CompetitorActionItem {
  id: string;
  organization_id: string;
  title: string;
  /** What competitors are doing. */
  detail: string;
  /** How Boxed2Built could match or beat it. */
  suggestion: string | null;
  category: ActionItemCategory;
  priority: ActionItemPriority;
  effort: ActionItemEffort;
  /** Which competitors were seen doing this. */
  competitor_names: string[];
  source_url: string | null;
  status: ActionItemStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  /** The last day the weekly run saw a competitor still doing this (YYYY-MM-DD). */
  last_seen_on: string;
  created_at: string;
  updated_at: string;
}
