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

export function formatGiftCardDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: (cents % 100 === 0) ? 0 : 2,
  }).format((cents || 0) / 100);
}
