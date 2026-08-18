# Print Shop (Store)

End-to-end overview of the Boxed2Built store — the storefront at `/store`, the
admin screens under `/admin/store`, the data model, and the edge functions.

Like gift cards, the store reuses the Stripe credentials and webhook endpoint
that already power the site. No new Stripe products, prices, webhook endpoints,
or environment variables are needed.

## Flow summary

1. A visitor opens `/store` (or taps **Store** in the header, next to the phone
   number). The page loads active products and store settings straight from
   Supabase with the anon key.
2. Adding an item opens the cart drawer, which holds the cart in
   `localStorage` (`boxed2built.store.cart`) so it survives a refresh.
3. The shopper picks shipping or local pickup, fills in contact (and address)
   details, and clicks **Checkout securely**.
4. `create-shop-checkout` re-reads every price, stock level, and fulfillment
   rule from the database, recomputes the totals, writes a `pending` order plus
   its line items, and creates a Stripe Checkout Session with
   `metadata.kind = 'shop_order'` and inline `price_data`.
5. Stripe redirects to `/store/success?session_id=...`, which polls
   `get-shop-order` until the order leaves `pending`.
6. Stripe's webhook hits the existing `stripe-webhook` endpoint. The
   `shop_order` branch marks the order `paid`, decrements tracked stock, and
   fires `send-shop-order-email`.
7. You work the order from `/admin/store-orders`: **Paid → In production →
   Shipped → Completed**, adding a carrier and tracking number on the way.

## Data model

### Tables

- **`shop_products`** — one row per item for sale. `slug` is unique. Prices are
  integer cents. `track_inventory = false` means made-to-order (never sells
  out); `true` uses `stock_quantity`. `is_active = false` keeps a product as a
  draft that only the admin sees.
- **`shop_settings`** — one row per business: storefront banner, shipping
  toggle, flat rate, free-shipping threshold, pickup toggle and instructions,
  sales-tax rate.
- **`shop_orders`** — one row per checkout attempt. `order_number` defaults to
  `SP-YYYYMMDD-XXXXX`. Statuses: `pending → paid → in_production → shipped →
  completed`, plus `canceled`, `refunded`, `failed`. Money is in cents;
  `stripe_checkout_session_id` is unique, which is what makes webhook handling
  idempotent.
- **`shop_order_items`** — line items. `product_name` and `unit_price_cents`
  are snapshots, so editing or deleting a product never rewrites order history.

### Postgres functions

- `decrement_shop_product_stock(p_product_id uuid, p_quantity integer)` —
  `SECURITY DEFINER`, granted to `service_role` only. Subtracts from tracked
  stock, floored at zero. Called after payment, never from the browser.

### RLS

- `anon` and `authenticated` may `SELECT` products where `is_active = true`,
  and the settings row. Both are public storefront data.
- Products and settings are managed by `is_platform_admin()` admins and
  organization members, matching the other operational tables.
- Orders and order items are admin/organization-member only, and `anon`'s
  table grants are revoked outright. Customers never read orders directly —
  the confirmation page goes through `get-shop-order` on the service role key.

### Storage

Product photos live in the public `shop-images` bucket (world-readable,
authenticated write), keyed by `{business_id}/{filename}`. Uploads are
converted from HEIC when needed and downscaled to 1400px WebP in the browser
before they are sent, the same path the gallery uses.

## Edge functions

| Function | Auth | Purpose |
| --- | --- | --- |
| `create-shop-checkout` | Public | Validates the cart, re-prices it from the database, writes a `pending` order + items, creates the Stripe Checkout Session, returns `{ url, order_id, order_number }`. |
| `stripe-webhook` | Public (signed by Stripe) | Unified webhook. Events with `metadata.kind === 'shop_order'` go to the shop branch: mark paid, decrement stock, send the receipt; mark `failed` on expiry/failure and `refunded` on `charge.refunded`. |
| `get-shop-order` | Public | Confirmation-page lookup by `session_id`. Returns a safe subset (order number, status, totals, item names). If the order is still `pending` it asks Stripe directly, as a webhook fallback. |
| `send-shop-order-email` | Public | Resend receipt with items, totals, and shipping/pickup details. Logged to `email_events`. |

`markShopOrderPaid` in `supabase/functions/_shared/shopOrder.ts` is shared by
the webhook and the confirmation fallback. It only flips an order that is still
`pending` and reports whether it won the race, so a customer never gets two
receipts for one order.

### Money is always recomputed server-side

The browser sends only product ids and quantities. Prices, shipping, tax, and
stock limits are read from the database inside `create-shop-checkout`, so a
tampered cart cannot set its own prices. The totals shown in the drawer are a
preview of the same calculation (`calculateCartTotals` in
`src/services/shopService.ts`) — keep the two in step if you change the rules.

## Admin

**Store Products** (`/admin/store`)

- Add, edit, hide, and delete products; upload a main photo plus extra photos.
- Toggle inventory tracking per product, set stock, lead time, max per order,
  and whether an item ships or is pickup-only.
- **Store settings** opens the shipping rate, free-shipping threshold, pickup
  instructions, sales-tax rate, and the storefront banner.
- Hiding a product (`is_active = false`) is the safe way to retire something —
  deleting is fine too, since orders keep their own snapshot of the item.

**Store Orders** (`/admin/store-orders`)

- Filter by status, search by order number/name/email.
- Expand an order for items, totals, contact details, shipping address, and the
  customer's note.
- Move the status along, record carrier + tracking, and keep internal notes.

## Operational notes

- **Sales tax** defaults to 0%. Set it in Store settings once you're registered
  to collect it in Tennessee; it is applied to the subtotal and shown as its own
  Stripe line item.
- **Free shipping threshold** is optional — leave it blank to always charge the
  flat rate.
- **Stock** only decrements after Stripe confirms payment, so an abandoned
  checkout never holds inventory. Two people can both buy the last unit in the
  same minute; the second order simply drives stock to zero rather than
  negative. Watch for it on low-stock items.
- **Refunds** are issued in Stripe. The `charge.refunded` event flips the order
  to `refunded` here; stock is not automatically restored.
- **Test mode** follows the existing `stripe_settings.stripe_mode` switch, the
  same as invoices and gift cards.

## Deploying

The migration is `supabase/migrations/20260818120000_create_print_shop_system.sql`.
The store also needs these functions deployed:

```
supabase functions deploy create-shop-checkout
supabase functions deploy get-shop-order
supabase functions deploy send-shop-order-email
supabase functions deploy stripe-webhook   # picks up the shop_order branch
```

No new Stripe or Resend configuration is required — the existing
`Stripe_Live_Secret_Key` / `Stripe_Sandbox_Secret_Key`, `STRIPE_WEBHOOK_SECRET`,
and `RESEND_API_KEY` secrets cover it.
