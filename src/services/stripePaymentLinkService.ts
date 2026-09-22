import { supabase } from '../lib/supabase';
import { recordPayment } from './invoiceService';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface UnlinkedStripePayment {
  id: string;
  amount: number;
  currency: string;
  created: string;
  description: string | null;
  /** Human label such as "Tap to Pay · VISA ····4242" or "Apple Pay · VISA ····4242". */
  methodLabel: string;
  /** True for a contactless charge taken in person on a phone or reader. */
  inPerson: boolean;
  receiptEmail: string | null;
}

/**
 * Recent succeeded Stripe payments not yet recorded against any invoice.
 *
 * A Tap to Pay charge taken in the Stripe Dashboard app carries no invoice
 * metadata, so nothing links it back here automatically. This is what the admin
 * picks from to close out the invoice.
 */
export async function listUnlinkedStripePayments(
  lookbackDays = 30,
): Promise<UnlinkedStripePayment[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/list-unlinked-stripe-payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ lookbackDays }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load Stripe payments');
  return (body?.payments ?? []) as UnlinkedStripePayment[];
}

/**
 * Records a Stripe payment against an invoice.
 *
 * The amount is taken from Stripe rather than from anything typed in, so the
 * invoice can only ever be credited what was actually charged. Postgres holds
 * the real guarantee against double-crediting: a partial unique index on
 * payment_reference for pi_/cs_ ids, which the webhook and the reconciler also
 * write. A duplicate surfaces as 23505 and is reported as already linked.
 */
export async function linkStripePaymentToInvoice(
  invoiceId: string,
  payment: UnlinkedStripePayment,
): Promise<void> {
  try {
    await recordPayment({
      invoice_id: invoiceId,
      payment_date: payment.created.split('T')[0],
      payment_amount: payment.amount,
      payment_method: payment.inPerson ? 'tap_to_pay' : 'credit_card',
      payment_reference: payment.id,
      notes: `Linked from Stripe · ${payment.methodLabel}`,
      source: 'stripe_terminal',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('23505') || message.toLowerCase().includes('duplicate key')) {
      throw new Error('That Stripe payment is already linked to an invoice.');
    }
    throw error;
  }
}
