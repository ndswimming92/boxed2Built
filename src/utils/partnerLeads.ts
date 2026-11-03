import type { PartnerCategory, PartnerLead, PartnerLink, PartnerStatus } from '../types/partnerLeads';
// The explicit .ts is for the unit tests, which run this file on node directly.
import { daysBetween } from './grants.ts';
import { centralToday, safeExternalUrl } from './news.ts';

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  moving: 'Moving company',
  apartments: 'Apartments',
  townhomes_hoa: 'Townhomes / HOA',
  property_management: 'Property management',
  realtor: 'Realtor',
  home_builder: 'Home builder',
  staging_design: 'Staging & design',
  furniture_retail: 'Furniture store',
  senior_living: 'Senior living',
  other: 'Other',
};

export const PARTNER_CATEGORIES = Object.keys(PARTNER_CATEGORY_LABELS) as PartnerCategory[];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  talking: 'In talks',
  partner: 'Partner',
  not_a_fit: 'Not a fit',
  do_not_contact: 'Do not contact',
};

/** The tabs, in order. Not a fit and do-not-contact share the last one. */
export const STATUS_TABS: Array<{ key: string; label: string; statuses: PartnerStatus[]; empty: string }> = [
  {
    key: 'new',
    label: 'New',
    statuses: ['new'],
    empty: 'No new leads right now. The daily search adds 5–10 here every morning.',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    statuses: ['contacted'],
    empty: 'Nobody emailed yet. Send an email from a New lead and it moves here.',
  },
  {
    key: 'talking',
    label: 'In talks',
    statuses: ['talking'],
    empty: 'When someone replies, set their status to In talks.',
  },
  { key: 'partner', label: 'Partners', statuses: ['partner'], empty: 'No partners yet.' },
  {
    key: 'closed',
    label: 'Passed',
    statuses: ['not_a_fit', 'do_not_contact'],
    empty: 'Nothing here. Leads marked Not a fit or Do not contact are kept here so they are not found again.',
  },
];

/** These cannot be emailed: the send function refuses them too. */
export function canEmail(status: PartnerStatus): boolean {
  return status !== 'not_a_fit' && status !== 'do_not_contact';
}

/** One plain address, the same rule the send function uses. */
export function isPlainEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const email = value.trim();
  return email.length <= 320 && /^[^@\s,;<>"']+@[^@\s,;<>"']+\.[^@\s,;<>"']+$/.test(email);
}

/** The links column, keeping only well-formed http(s) entries. */
export function partnerLinks(links: unknown): PartnerLink[] {
  if (!Array.isArray(links)) return [];
  const out: PartnerLink[] = [];
  for (const entry of links) {
    if (!entry || typeof entry !== 'object') continue;
    const { label, url } = entry as Record<string, unknown>;
    const safe = typeof url === 'string' ? safeExternalUrl(url) : null;
    if (!safe || typeof label !== 'string' || !label.trim()) continue;
    out.push({ label: label.trim(), url: safe });
  }
  return out;
}

/** "Found today", "Found yesterday", "Found 3 days ago", or the date. */
export function foundLabel(foundOn: string, today: string = centralToday()): string {
  const days = daysBetween(foundOn, today);
  if (days === null || days < 0) return `Found ${foundOn}`;
  if (days === 0) return 'Found today';
  if (days === 1) return 'Found yesterday';
  if (days < 7) return `Found ${days} days ago`;
  return `Found ${foundOn}`;
}

/** Newest first; among the same day, leads with an email first (they can be acted on now). */
export function sortLeads<T extends Pick<PartnerLead, 'found_on' | 'email' | 'name' | 'status_changed_at'>>(
  leads: T[],
  tab: string,
): T[] {
  return [...leads].sort((a, b) => {
    if (tab !== 'new') {
      const changed = (b.status_changed_at ?? '').localeCompare(a.status_changed_at ?? '');
      if (changed) return changed;
    }
    return (
      b.found_on.localeCompare(a.found_on) ||
      Number(isPlainEmail(b.email)) - Number(isPlainEmail(a.email)) ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    );
  });
}

export function matchesLeadSearch(lead: PartnerLead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [lead.name, lead.location, lead.contact_name, lead.email, lead.summary, PARTNER_CATEGORY_LABELS[lead.category]]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}
