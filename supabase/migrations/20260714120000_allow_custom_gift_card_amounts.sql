/*
  # Allow custom gift card amounts

  Previously `gift_cards.initial_amount_cents` was restricted by a CHECK
  constraint to the four preset denominations ($25/$50/$100/$200). Customers
  can now enter a custom amount, so this widens the allow-list to:

    - any of the preset denominations (2500, 5000, 10000, 20000), OR
    - any whole-dollar amount (a multiple of 100 cents) between
      $10 (1000 cents) and $1,000 (100000 cents), inclusive.

  Bounds are kept in sync with:
    - src/constants/giftCards.ts (GIFT_CARD_MIN_CENTS / GIFT_CARD_MAX_CENTS)
    - supabase/functions/create-gift-card-checkout (CUSTOM_MIN_CENTS / CUSTOM_MAX_CENTS)
*/

-- Drop the original inline constraint (auto-named <table>_<column>_check).
ALTER TABLE gift_cards
  DROP CONSTRAINT IF EXISTS gift_cards_initial_amount_cents_check;

-- Re-add a named constraint that also permits bounded whole-dollar custom amounts.
ALTER TABLE gift_cards
  ADD CONSTRAINT gift_cards_initial_amount_cents_check
  CHECK (
    initial_amount_cents IN (2500, 5000, 10000, 20000)
    OR (
      initial_amount_cents % 100 = 0
      AND initial_amount_cents >= 1000
      AND initial_amount_cents <= 100000
    )
  );
