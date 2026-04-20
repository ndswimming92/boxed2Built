export type GiftCardStatus =
  | 'pending'
  | 'active'
  | 'partially_redeemed'
  | 'redeemed'
  | 'voided'
  | 'failed';

export type GiftCardDeliveryType = 'self' | 'recipient';

export interface GiftCard {
  id: string;
  code: string;
  initial_amount_cents: number;
  remaining_amount_cents: number;
  status: GiftCardStatus;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string | null;
  recipient_email: string | null;
  delivery_type: GiftCardDeliveryType;
  personal_message: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GiftCardRedemption {
  id: string;
  gift_card_id: string;
  job_id: string | null;
  invoice_id: string | null;
  redeemed_amount_cents: number;
  redeemed_by_name: string | null;
  redeemed_by_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface GiftCardLookupResult {
  code: string;
  status: GiftCardStatus;
  initial_amount_cents: number;
  remaining_amount_cents: number;
  recipient_first_name: string | null;
  delivery_type: GiftCardDeliveryType;
  activated_at: string | null;
}
