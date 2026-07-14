export interface GiftCardDenomination {
  label: string;
  amountCents: number;
  dollars: number;
  /** TODO: Replace with real Stripe Price IDs from the Stripe dashboard. */
  stripePriceIdEnvKey: string;
}

export const GIFT_CARD_DENOMINATIONS: GiftCardDenomination[] = [
  { label: '$25', dollars: 25, amountCents: 2500, stripePriceIdEnvKey: 'STRIPE_GIFT_CARD_PRICE_25' },
  { label: '$50', dollars: 50, amountCents: 5000, stripePriceIdEnvKey: 'STRIPE_GIFT_CARD_PRICE_50' },
  { label: '$100', dollars: 100, amountCents: 10000, stripePriceIdEnvKey: 'STRIPE_GIFT_CARD_PRICE_100' },
  { label: '$200', dollars: 200, amountCents: 20000, stripePriceIdEnvKey: 'STRIPE_GIFT_CARD_PRICE_200' },
];

export const ALLOWED_GIFT_CARD_AMOUNTS_CENTS = new Set(
  GIFT_CARD_DENOMINATIONS.map((d) => d.amountCents),
);

/** Bounds for a customer-entered custom gift card amount. */
export const GIFT_CARD_MIN_CENTS = 1000; // $10
export const GIFT_CARD_MAX_CENTS = 100000; // $1,000

/**
 * Whether a whole-cent amount is an acceptable gift card value: either one of
 * the preset denominations, or a whole-dollar custom amount within bounds.
 */
export function isValidGiftCardAmountCents(cents: number): boolean {
  if (!Number.isInteger(cents)) return false;
  if (ALLOWED_GIFT_CARD_AMOUNTS_CENTS.has(cents)) return true;
  return (
    cents % 100 === 0 &&
    cents >= GIFT_CARD_MIN_CENTS &&
    cents <= GIFT_CARD_MAX_CENTS
  );
}

/**
 * Parse a user-entered dollar string (e.g. "75" or "75.00") into whole cents.
 * Returns null when the input isn't a positive whole-dollar amount.
 */
export function parseCustomAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  if (cents % 100 !== 0) return null; // whole dollars only
  return cents;
}

export function formatGiftCardDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: (cents % 100 === 0) ? 0 : 2,
  }).format((cents || 0) / 100);
}
