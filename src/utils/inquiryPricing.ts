import { FURNITURE } from './furnitureCatalog.ts';
import { DRIVE_BANDS } from './jobMap.ts';
import type { PricingGroup } from './jobMapPricing.ts';

/**
 * What to charge for one inquiry, from the same figures as the Job Map's
 * pricing recommendations: the target rate for the time on site, plus the drive
 * at the target rate both ways and the mileage. Pure functions.
 */

const METERS_PER_MILE = 1609.344;

const roundTo5 = (amount: number) => Math.max(5, Math.round(amount / 5) * 5);

/** The drive to the work address, one way. */
export interface InquiryDrive {
  seconds: number;
  miles: number | null;
}

export interface InquiryQuoteInputs {
  /** Hours on site. Null when the inquiry gives nothing to estimate from. */
  hours: number | null;
  /** What the customer was shown on the form, after any coupon. */
  shownPrice: number | null;
  /** Dollars the coupon took off the shown price. */
  couponAmount: number;
  targetRate: number;
  ratePerMile: number;
  /** Null until a work address has been entered and located. */
  drive: InquiryDrive | null;
}

export interface InquiryQuote {
  hours: number;
  /** Time on site at the target rate. */
  labor: number;
  /** One visit's round trip at the target rate plus mileage. Null without an address. */
  travel: number | null;
  /** Labor plus travel, rounded to $5. Before any coupon. */
  recommended: number;
  /** Smallest job worth the trip: one hour on site plus the travel. */
  minimumJob: number;
  /** The form's price before the coupon came off, to compare like with like. */
  shownBeforeCoupon: number | null;
  /** Recommended minus what the form showed. Positive means the form came in low. */
  gap: number | null;
}

/** "3.5 hours" -> 3.5. Null for anything without a positive number in it. */
export function parseHours(text: string | null | undefined): number | null {
  const hours = parseFloat(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

/** "$1,250" -> 1250. Null for anything without a positive number in it. */
export function parseMoney(text: string | number | null | undefined): number | null {
  const amount = parseFloat(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Hours on site for an inquiry: the form's own estimate, or the catalog time
 * for its furniture type when an older or hand-made inquiry carries none.
 */
export function inquiryHours(inquiry: {
  estimated_time: string | null;
  furniture_type: string;
  pieces: number;
}): number | null {
  const stated = parseHours(inquiry.estimated_time);
  if (stated !== null) return stated;
  const item = FURNITURE.find((entry) => entry.id === inquiry.furniture_type);
  const pieces = Number(inquiry.pieces);
  return item && pieces > 0 ? (item.minutes * pieces) / 60 : null;
}

export function driveFrom(durationSeconds: number | null, distanceMeters: number | null): InquiryDrive | null {
  if (durationSeconds == null) return null;
  return { seconds: durationSeconds, miles: distanceMeters != null ? distanceMeters / METERS_PER_MILE : null };
}

/** Null when there are no hours to price. */
export function buildInquiryQuote(inputs: InquiryQuoteInputs): InquiryQuote | null {
  if (inputs.hours === null || !(inputs.targetRate > 0)) return null;

  const labor = inputs.targetRate * inputs.hours;
  const travel = inputs.drive
    ? (inputs.targetRate * 2 * inputs.drive.seconds) / 3600 + 2 * (inputs.drive.miles ?? 0) * inputs.ratePerMile
    : null;
  const recommended = roundTo5(labor + (travel ?? 0));
  const shownBeforeCoupon = inputs.shownPrice !== null ? inputs.shownPrice + Math.max(0, inputs.couponAmount) : null;

  return {
    hours: inputs.hours,
    labor,
    travel,
    recommended,
    minimumJob: roundTo5(inputs.targetRate + (travel ?? 0)),
    shownBeforeCoupon,
    gap: shownBeforeCoupon !== null ? recommended - shownBeforeCoupon : null,
  };
}

/**
 * The Job Map group that says most about this address: the town named in it,
 * or failing that the drive-time band it falls in.
 */
export function matchPricingGroup(
  address: string | null,
  drive: InquiryDrive | null,
  areas: PricingGroup[],
  bands: PricingGroup[],
): PricingGroup | null {
  const text = address?.toLowerCase() ?? '';
  if (text) {
    // Longest name first, so "East Nashville" is not claimed by "Nashville".
    const named = [...areas]
      .filter((area) => area.label !== 'Unknown area')
      .sort((a, b) => b.label.length - a.label.length)
      .find((area) => text.includes(area.label.toLowerCase()));
    if (named) return named;
  }
  if (!drive) return null;
  const band = DRIVE_BANDS.find((entry) => drive.seconds / 60 < entry.maxMinutes);
  return bands.find((group) => group.label === band?.label) ?? null;
}
