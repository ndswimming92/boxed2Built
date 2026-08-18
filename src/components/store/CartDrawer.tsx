import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Lock, Minus, Plus, ShoppingBag, Store, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { calculateCartTotals, createShopCheckout, formatMoney } from '../../services/shopService';
import type { ShopFulfillmentMethod, ShopSettings } from '../../types/shop';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CartDrawerProps {
  settings: ShopSettings | null;
}

type CheckoutForm = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_line1: string;
  shipping_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  customer_note: string;
};

const emptyForm: CheckoutForm = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  shipping_line1: '',
  shipping_line2: '',
  shipping_city: '',
  shipping_state: 'TN',
  shipping_postal_code: '',
  customer_note: '',
};

const CartDrawer: React.FC<CartDrawerProps> = ({ settings }) => {
  const { lines, isOpen, closeCart, setQuantity, removeItem, itemCount } = useCart();
  const { showToast } = useToast();

  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const shippingOffered = settings?.shipping_enabled ?? true;
  const pickupOffered = settings?.local_pickup_enabled ?? true;
  const pickupOnlyCart = lines.length > 0 && lines.every((line) => !line.requiresShipping);

  const [fulfillment, setFulfillment] = useState<ShopFulfillmentMethod>(
    shippingOffered ? 'shipping' : 'pickup',
  );

  // Keep the selection valid as the cart and store settings change: a
  // pickup-only cart (or a store with shipping switched off) forces pickup.
  useEffect(() => {
    if ((pickupOnlyCart || !shippingOffered) && pickupOffered) {
      setFulfillment('pickup');
    } else if (!pickupOffered) {
      setFulfillment('shipping');
    }
  }, [pickupOnlyCart, shippingOffered, pickupOffered]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  const totals = useMemo(
    () => calculateCartTotals(lines, settings, fulfillment),
    [lines, settings, fulfillment],
  );

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof CheckoutForm, string>> = {};
    if (!form.customer_name.trim()) next.customer_name = 'Please enter your name.';
    if (!EMAIL_RE.test(form.customer_email.trim())) next.customer_email = 'Enter a valid email.';

    if (fulfillment === 'shipping') {
      if (!form.shipping_line1.trim()) next.shipping_line1 = 'Street address is required.';
      if (!form.shipping_city.trim()) next.shipping_city = 'City is required.';
      if (!form.shipping_state.trim()) next.shipping_state = 'State is required.';
      if (!/^\d{5}(-\d{4})?$/.test(form.shipping_postal_code.trim())) {
        next.shipping_postal_code = 'Enter a 5-digit ZIP code.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lines.length === 0 || !validate()) return;

    setSubmitting(true);
    try {
      const { url } = await createShopCheckout({
        items: lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        fulfillment_method: fulfillment,
        shipping_line1: fulfillment === 'shipping' ? form.shipping_line1.trim() : undefined,
        shipping_line2:
          fulfillment === 'shipping' ? form.shipping_line2.trim() || undefined : undefined,
        shipping_city: fulfillment === 'shipping' ? form.shipping_city.trim() : undefined,
        shipping_state: fulfillment === 'shipping' ? form.shipping_state.trim() : undefined,
        shipping_postal_code:
          fulfillment === 'shipping' ? form.shipping_postal_code.trim() : undefined,
        customer_note: form.customer_note.trim() || undefined,
      });
      // The cart is cleared on the success page so a canceled checkout keeps it.
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout.';
      showToast({ message, type: 'error' });
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass = (key: keyof CheckoutForm) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${
      errors[key] ? 'border-rose-400' : 'border-slate-300'
    }`;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Cart">
      <div className="absolute inset-0 bg-slate-900/50" onClick={closeCart} />

      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShoppingBag className="w-5 h-5 text-blue-700" />
            Your cart
            {itemCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {itemCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Boxes className="w-12 h-12 text-slate-300" />
            <p className="text-sm text-slate-600">Your cart is empty.</p>
            <button
              type="button"
              onClick={closeCart}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Keep browsing
            </button>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {lines.map((line) => (
                  <li key={line.productId} className="flex gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Boxes className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{line.name}</p>
                      <p className="text-xs text-slate-500">{formatMoney(line.priceCents)} each</p>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-md border border-slate-300">
                          <button
                            type="button"
                            onClick={() => setQuantity(line.productId, line.quantity - 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            aria-label={`Decrease quantity of ${line.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.productId, line.quantity + 1)}
                            disabled={line.quantity >= line.maxPerOrder}
                            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:text-slate-300"
                            aria-label={`Increase quantity of ${line.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(line.productId)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-slate-900">
                      {formatMoney(line.priceCents * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold text-slate-900">How should we get it to you?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFulfillment('shipping')}
                    disabled={!shippingOffered || pickupOnlyCart}
                    className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      fulfillment === 'shipping'
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Truck className="mb-1 h-4 w-4 text-blue-700" />
                    <span className="block font-semibold text-slate-900">Ship it</span>
                    <span className="block text-xs text-slate-500">
                      {formatMoney(settings?.flat_shipping_cents ?? 0)} flat
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillment('pickup')}
                    disabled={!pickupOffered}
                    className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      fulfillment === 'pickup'
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Store className="mb-1 h-4 w-4 text-blue-700" />
                    <span className="block font-semibold text-slate-900">Local pickup</span>
                    <span className="block text-xs text-slate-500">Free</span>
                  </button>
                </div>

                {fulfillment === 'pickup' && settings?.pickup_instructions && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {settings.pickup_instructions}
                  </p>
                )}

                {totals.freeShippingRemainingCents !== null &&
                  totals.freeShippingRemainingCents > 0 && (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      Add {formatMoney(totals.freeShippingRemainingCents)} more for free shipping.
                    </p>
                  )}
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold text-slate-900">Your details</p>

                <div>
                  <label htmlFor="cart_name" className="mb-1 block text-xs font-medium text-slate-600">
                    Name
                  </label>
                  <input
                    id="cart_name"
                    value={form.customer_name}
                    onChange={(event) => set('customer_name', event.target.value)}
                    className={fieldClass('customer_name')}
                    autoComplete="name"
                  />
                  {errors.customer_name && (
                    <p className="mt-1 text-xs text-rose-600">{errors.customer_name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="cart_email" className="mb-1 block text-xs font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    id="cart_email"
                    type="email"
                    value={form.customer_email}
                    onChange={(event) => set('customer_email', event.target.value)}
                    className={fieldClass('customer_email')}
                    autoComplete="email"
                  />
                  {errors.customer_email && (
                    <p className="mt-1 text-xs text-rose-600">{errors.customer_email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="cart_phone" className="mb-1 block text-xs font-medium text-slate-600">
                    Phone <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="cart_phone"
                    type="tel"
                    value={form.customer_phone}
                    onChange={(event) => set('customer_phone', event.target.value)}
                    className={fieldClass('customer_phone')}
                    autoComplete="tel"
                  />
                </div>

                {fulfillment === 'shipping' && (
                  <>
                    <div>
                      <label htmlFor="cart_line1" className="mb-1 block text-xs font-medium text-slate-600">
                        Street address
                      </label>
                      <input
                        id="cart_line1"
                        value={form.shipping_line1}
                        onChange={(event) => set('shipping_line1', event.target.value)}
                        className={fieldClass('shipping_line1')}
                        autoComplete="address-line1"
                      />
                      {errors.shipping_line1 && (
                        <p className="mt-1 text-xs text-rose-600">{errors.shipping_line1}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="cart_line2" className="mb-1 block text-xs font-medium text-slate-600">
                        Apt / suite <span className="text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="cart_line2"
                        value={form.shipping_line2}
                        onChange={(event) => set('shipping_line2', event.target.value)}
                        className={fieldClass('shipping_line2')}
                        autoComplete="address-line2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="cart_city" className="mb-1 block text-xs font-medium text-slate-600">
                          City
                        </label>
                        <input
                          id="cart_city"
                          value={form.shipping_city}
                          onChange={(event) => set('shipping_city', event.target.value)}
                          className={fieldClass('shipping_city')}
                          autoComplete="address-level2"
                        />
                        {errors.shipping_city && (
                          <p className="mt-1 text-xs text-rose-600">{errors.shipping_city}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="cart_state" className="mb-1 block text-xs font-medium text-slate-600">
                            State
                          </label>
                          <input
                            id="cart_state"
                            value={form.shipping_state}
                            onChange={(event) => set('shipping_state', event.target.value.toUpperCase())}
                            maxLength={2}
                            className={fieldClass('shipping_state')}
                            autoComplete="address-level1"
                          />
                        </div>
                        <div>
                          <label htmlFor="cart_zip" className="mb-1 block text-xs font-medium text-slate-600">
                            ZIP
                          </label>
                          <input
                            id="cart_zip"
                            value={form.shipping_postal_code}
                            onChange={(event) => set('shipping_postal_code', event.target.value)}
                            className={fieldClass('shipping_postal_code')}
                            autoComplete="postal-code"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    </div>
                    {errors.shipping_postal_code && (
                      <p className="text-xs text-rose-600">{errors.shipping_postal_code}</p>
                    )}
                  </>
                )}

                <div>
                  <label htmlFor="cart_note" className="mb-1 block text-xs font-medium text-slate-600">
                    Order notes <span className="text-slate-400">(color requests, etc.)</span>
                  </label>
                  <textarea
                    id="cart_note"
                    rows={2}
                    value={form.customer_note}
                    onChange={(event) => set('customer_note', event.target.value)}
                    className={fieldClass('customer_note')}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(totals.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>{fulfillment === 'pickup' ? 'Pickup' : 'Shipping'}</dt>
                  <dd>{totals.shippingCents === 0 ? 'Free' : formatMoney(totals.shippingCents)}</dd>
                </div>
                {totals.taxCents > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <dt>Sales tax</dt>
                    <dd>{formatMoney(totals.taxCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                  <dt>Total</dt>
                  <dd>{formatMoney(totals.totalCents)}</dd>
                </div>
              </dl>

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white shadow-md transition-colors hover:bg-blue-800 disabled:cursor-wait disabled:bg-slate-400"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Starting checkout…' : 'Checkout securely'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Payments are processed by Stripe. Card details never touch our site.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
