import { Head } from 'vite-react-ssg';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail, Package, Store } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useCart } from '../contexts/CartContext';
import { formatMoney, getShopOrderConfirmation } from '../services/shopService';
import type { ShopOrderConfirmation } from '../services/shopService';

const StoreSuccessPage: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const { clearCart } = useCart();

  const [order, setOrder] = useState<ShopOrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  // The cart survives a canceled checkout; clearing it here means only a
  // completed return trip empties it.
  const clearedRef = useRef(false);
  useEffect(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let canceled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const data = await getShopOrderConfirmation(sessionId);
        if (canceled) return;

        setOrder(data);
        if (data && data.status !== 'pending') {
          setPending(false);
          setLoading(false);
          return;
        }

        // The Stripe webhook flips the order to paid a beat after the redirect.
        setPending(true);
        if (attempts < 8) {
          setTimeout(poll, 1500);
        } else {
          setLoading(false);
        }
      } catch {
        if (!canceled) setLoading(false);
      }
    };

    poll();
    return () => {
      canceled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>Order Confirmed | Boxed2Built Print Shop</title>
        <meta name="description" content="Your Boxed2Built print shop order is confirmed." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://boxed2built.com/store/success" />
      </Head>

      <Header />

      <main className="min-h-[60vh] pt-28 pb-20">
        <section className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            {loading && !order ? (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-700" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Confirming your order…</h1>
                <p className="mt-2 text-slate-600">This only takes a moment.</p>
              </>
            ) : !sessionId || !order ? (
              <>
                <Package className="mx-auto h-10 w-10 text-blue-700" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Thanks for your order!</h1>
                <p className="mt-2 leading-relaxed text-slate-600">
                  If you completed checkout, a confirmation email is on its way. Questions about an
                  order? Reach out and we'll track it down.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">
                  Order {order.order_number} confirmed
                </h1>
                <p className="mt-2 leading-relaxed text-slate-600">
                  Thanks{order.customer_first_name ? `, ${order.customer_first_name}` : ''}! We're
                  queuing your print now.
                </p>

                {pending && (
                  <p className="mt-3 text-sm text-slate-500">
                    Payment is still settling with Stripe — your emailed receipt is the final word.
                  </p>
                )}

                <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-left">
                  {order.items.map((item, index) => (
                    <li key={`${item.product_name}-${index}`} className="flex justify-between gap-4 px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {item.product_name}
                        <span className="text-slate-400"> × {item.quantity}</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatMoney(item.line_total_cents)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-4 px-4 py-3 text-sm text-slate-600">
                    <span>{order.fulfillment_method === 'pickup' ? 'Local pickup' : 'Shipping'}</span>
                    <span>
                      {order.shipping_cents === 0 ? 'Free' : formatMoney(order.shipping_cents)}
                    </span>
                  </li>
                  {order.tax_cents > 0 && (
                    <li className="flex justify-between gap-4 px-4 py-3 text-sm text-slate-600">
                      <span>Sales tax</span>
                      <span>{formatMoney(order.tax_cents)}</span>
                    </li>
                  )}
                  <li className="flex justify-between gap-4 bg-slate-50 px-4 py-3 font-bold text-slate-900">
                    <span>Total</span>
                    <span>{formatMoney(order.total_cents)}</span>
                  </li>
                </ul>

                <div className="mt-6 flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-left">
                  {order.fulfillment_method === 'pickup' ? (
                    <Store className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
                  ) : (
                    <Package className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
                  )}
                  <p className="text-sm leading-relaxed text-blue-900">
                    {order.fulfillment_method === 'pickup'
                      ? "We'll email you as soon as it's printed and ready to pick up"
                      : "We'll email you a tracking number as soon as it ships"}
                    {order.lead_time_days > 0
                      ? ` — usually within ${order.lead_time_days} ${
                          order.lead_time_days === 1 ? 'day' : 'days'
                        }.`
                      : '.'}
                  </p>
                </div>
              </>
            )}

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="/store"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-800"
              >
                <Store className="h-5 w-5" />
                Back to the shop
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Mail className="h-5 w-5" />
                Contact us
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default StoreSuccessPage;
