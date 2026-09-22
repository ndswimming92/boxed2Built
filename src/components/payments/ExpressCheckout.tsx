import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

interface ExpressCheckoutProps {
  invoiceId: string;
  /** Public pay-link token. Omitted for portal payers, who authenticate instead. */
  paymentToken?: string;
  /** 'portal' authenticates via the Supabase session; anything else uses the token. */
  source?: string;
  returnUrl: string;
  onError: (message: string) => void;
  /** Fires once we know whether this device offers a wallet, so the caller can
   *  adjust the surrounding copy rather than leaving a labelled empty box. */
  onAvailabilityChange?: (hasWallet: boolean) => void;
}

interface IntentResponse {
  clientSecret: string;
  publishableKey: string;
}

// Stripe.js is a single global script. Cache per publishable key so remounting
// the pay page (or flipping Stripe modes) doesn't reload it needlessly.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string): Promise<Stripe | null> {
  const cached = stripePromiseCache.get(publishableKey);
  if (cached) return cached;
  const promise = loadStripe(publishableKey);
  stripePromiseCache.set(publishableKey, promise);
  return promise;
}

function ExpressCheckoutInner({
  returnUrl,
  onError,
  onAvailabilityChange,
}: Pick<ExpressCheckoutProps, 'returnUrl' | 'onError' | 'onAvailabilityChange'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    // On success the browser has already left for return_url, so anything we
    // get back here is a failure worth showing.
    if (error) {
      onError(error.message || 'That payment could not be completed. Please try again.');
    }
  };

  return (
    <div className={hasWallet === false ? 'hidden' : undefined}>
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onReady={({ availablePaymentMethods }) => {
          const available = Boolean(
            availablePaymentMethods && Object.keys(availablePaymentMethods).length > 0,
          );
          setHasWallet(available);
          onAvailabilityChange?.(available);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

/**
 * Renders Apple Pay / Google Pay buttons inline on the pay page, so an iPhone
 * customer pays with Face ID without ever being redirected to Stripe.
 *
 * Renders nothing on a device with no wallet configured — the caller must keep
 * its ordinary card button as the path for everyone else.
 */
export default function ExpressCheckout({
  invoiceId,
  paymentToken,
  source,
  returnUrl,
  onError,
  onAvailabilityChange,
}: ExpressCheckoutProps) {
  const [intent, setIntent] = useState<IntentResponse | null>(null);
  // A failed intent must not nag the customer: the card button still works, so
  // we fall silent and let them use it.
  const [failed, setFailed] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    let cancelled = false;

    const createIntent = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ invoiceId, paymentToken, source }),
        });

        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.clientSecret || !data.publishableKey) {
          setFailed(true);
          onAvailabilityChange?.(false);
          return;
        }

        setIntent({ clientSecret: data.clientSecret, publishableKey: data.publishableKey });
      } catch {
        if (!cancelled) {
          setFailed(true);
          onAvailabilityChange?.(false);
        }
      }
    };

    void createIntent();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, paymentToken, source, onAvailabilityChange]);

  const stripePromise = useMemo(
    () => (intent ? getStripePromise(intent.publishableKey) : null),
    [intent],
  );

  if (failed || !intent || !stripePromise) return null;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
      <ExpressCheckoutInner
        returnUrl={returnUrl}
        onError={onError}
        onAvailabilityChange={onAvailabilityChange}
      />
    </Elements>
  );
}
