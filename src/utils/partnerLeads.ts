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

// ---------------------------------------------------------------------------
// Partner codes

/** Coupon codes are 3–30 of A–Z, 0–9 and dashes, starting with a letter or digit. */
export const PARTNER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

const CODE_FILLER = new Set(['THE', 'OF', 'AND', 'AT', 'LLC', 'INC', 'CO', 'TN', 'GROUP', 'COMPANY', 'SERVICES', 'TEAM']);

/** "Grand Welcome of Franklin" -> "GRANDWELCOME"; short, typeable, from the first two words that matter. */
export function suggestPartnerCode(name: string): string {
  const words = name
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !CODE_FILLER.has(word));
  const code = words.slice(0, 2).join('').slice(0, 16);
  return code.length >= 3 ? code : 'PARTNER';
}

/** Typed code tidied the way the database stores it. */
export function normalizePartnerCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
}

/** The request form link that applies the code for the customer. */
export function partnerCodeLink(code: string): string {
  return `https://boxed2built.com/contact?coupon=${encodeURIComponent(code)}`;
}

/** "$25 off" / "10% off". */
export function describePartnerDiscount(type: 'fixed' | 'percentage', value: number): string {
  if (type === 'percentage') return `${Number.isInteger(value) ? value : value.toFixed(1)}% off`;
  return `$${Number.isInteger(value) ? value : value.toFixed(2)} off`;
}

/** The lines the editor adds to an email for a partner's code. */
export function partnerCodeSnippet(code: string, discount: string): string {
  return `Anyone you send our way can use code **${code}** for ${discount} their furniture assembly or TV mounting.\n\n[button: Book with code ${code}](${partnerCodeLink(code)})`;
}

/**
 * Puts a snippet just above the sign-off ("Thanks for your time," and the name
 * under it) so the closing stays last. With no recognisable sign-off the
 * snippet goes at the end.
 */
export function insertBeforeClosing(body: string, snippet: string): string {
  const text = body.replace(/\s+$/, '');
  if (!text) return snippet;
  const paragraphs = text.split(/\n{2,}/);
  const last = paragraphs[paragraphs.length - 1];
  const firstLine = last.split('\n')[0].trim();
  const isClosing = paragraphs.length > 1 && firstLine.length <= 40 && /,$/.test(firstLine) && !/[.!?]/.test(firstLine);
  if (!isClosing) return `${text}\n\n${snippet}`;
  return [...paragraphs.slice(0, -1), snippet, last].join('\n\n');
}

// ---------------------------------------------------------------------------
// Email activity

export interface EmailActivitySummary {
  delivered: boolean;
  opened: boolean;
  bounced: boolean;
  complained: boolean;
  /** Links clicked, most recent first, without duplicates. */
  clicks: string[];
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
}

export function summarizeEmailActivity(events: Array<{ event_type: string; occurred_at: string; link: string | null }>): EmailActivitySummary {
  const summary: EmailActivitySummary = {
    delivered: false,
    opened: false,
    bounced: false,
    complained: false,
    clicks: [],
    lastOpenedAt: null,
    lastClickedAt: null,
  };
  const sorted = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  for (const event of sorted) {
    switch (event.event_type) {
      case 'email.delivered':
        summary.delivered = true;
        break;
      case 'email.opened':
        summary.opened = true;
        summary.lastOpenedAt ??= event.occurred_at;
        break;
      case 'email.clicked':
        // A click means it was opened, even when the open pixel was blocked.
        summary.opened = true;
        summary.lastClickedAt ??= event.occurred_at;
        if (event.link && !summary.clicks.includes(event.link)) summary.clicks.push(event.link);
        break;
      case 'email.bounced':
        summary.bounced = true;
        break;
      case 'email.complained':
        summary.complained = true;
        break;
    }
  }
  return summary;
}

/** A clicked link as a short label: the page path, without the tracking tags. */
export function clickedLinkLabel(link: string): string {
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/\/$/, '') || '/';
    return url.hostname.replace(/^www\./, '') === 'boxed2built.com' ? `boxed2built.com${path === '/' ? '' : path}` : `${url.hostname}${path === '/' ? '' : path}`;
  } catch {
    return link;
  }
}
