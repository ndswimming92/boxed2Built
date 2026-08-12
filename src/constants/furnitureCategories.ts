/**
 * Single source of truth for the quote form's furniture categories.
 *
 * These values flow a long way downstream — `form_inquiries.furniture_type`,
 * `saved_requests.furniture_type`, the owner + customer emails, the admin
 * Inquiries list/filter, the `/lookup-request` page, the request PDF, and
 * `jobs.job_type` when an inquiry is converted. Both DB columns are plain
 * `text` with no CHECK constraint, so new values are accepted as-is, but
 * historical rows keep whatever label they were submitted with. Renaming a
 * `value` therefore splits reporting across the old and new spelling — add
 * new categories rather than rewording existing ones.
 */

export interface FurnitureCategory {
  /** Persisted verbatim as `furniture_type`. Stable identifier — see note above. */
  value: string;
  /** Customer-facing label in the quote form. Safe to reword. */
  label: string;
  /** Minutes to assemble a single piece, for the instant estimate. */
  baseMinutes: number;
  /** Dollars to assemble a single piece, for the instant estimate. */
  basePrice: number;
}

/** The category used for anything not covered by the list; requires a note. */
export const OTHER_CATEGORY_VALUE = 'Other';

/**
 * Order here is the order rendered in the form.
 */
export const FURNITURE_CATEGORIES: readonly FurnitureCategory[] = [
  { value: 'Chair', label: 'Dining Chairs', baseMinutes: 60, basePrice: 85 },
  { value: 'Table', label: 'Tables & Desks', baseMinutes: 120, basePrice: 185 },
  { value: 'Bed', label: 'Bed Frames', baseMinutes: 180, basePrice: 295 },
  { value: 'Dresser', label: 'Dressers & Storage', baseMinutes: 210, basePrice: 320 },
  { value: 'Bookshelf', label: 'Bookshelves & Media Units', baseMinutes: 150, basePrice: 220 },
  { value: 'IKEA', label: 'IKEA Furniture', baseMinutes: 120, basePrice: 185 },
  { value: OTHER_CATEGORY_VALUE, label: 'Other (please specify in notes)', baseMinutes: 120, basePrice: 185 },
];

/** Estimate basis for a value with no matching category (legacy rows, API submissions). */
export const FALLBACK_ESTIMATE_BASIS = { baseMinutes: 120, basePrice: 185 };

export function getFurnitureCategory(value: string): FurnitureCategory | undefined {
  return FURNITURE_CATEGORIES.find((category) => category.value === value);
}

/**
 * Guards the form's category field. Kept as a lookup rather than a hardcoded
 * allowlist so adding a category to `FURNITURE_CATEGORIES` is all it takes —
 * a mismatch here blocks submission entirely.
 */
export function isFurnitureCategory(value: string): boolean {
  return getFurnitureCategory(value) !== undefined;
}

/** Estimate basis for a category value, falling back for unrecognised values. */
export function getEstimateBasis(value: string): { baseMinutes: number; basePrice: number } {
  const category = getFurnitureCategory(value);
  if (!category) return FALLBACK_ESTIMATE_BASIS;
  return { baseMinutes: category.baseMinutes, basePrice: category.basePrice };
}
