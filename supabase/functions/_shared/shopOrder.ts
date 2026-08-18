import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface MarkPaidParams {
  orderId: string;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}

/**
 * Flips a print shop order from `pending` to `paid`, decrements tracked stock,
 * and sends the confirmation email.
 *
 * Both the Stripe webhook and the confirmation-page fallback call this, so the
 * status update is guarded on `status = 'pending'` and the function reports
 * whether it was the one that won: only that caller sends the email, which
 * keeps a customer from getting two receipts for one order.
 */
export async function markShopOrderPaid(
  admin: SupabaseClient,
  { orderId, sessionId, paymentIntentId }: MarkPaidParams,
): Promise<boolean> {
  const { data: updated, error } = await admin
    .from('shop_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      ...(sessionId ? { stripe_checkout_session_id: sessionId } : {}),
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Failed to mark shop order paid:', error);
    return false;
  }
  if (!updated || updated.length === 0) {
    // Another caller already processed this order.
    return false;
  }

  await decrementStock(admin, orderId);
  await sendConfirmationEmail(orderId);
  return true;
}

async function decrementStock(admin: SupabaseClient, orderId: string): Promise<void> {
  const { data: items, error } = await admin
    .from('shop_order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (error) {
    console.error('Could not read order items for stock decrement:', error);
    return;
  }

  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const { error: rpcError } = await admin.rpc('decrement_shop_product_stock', {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    });
    if (rpcError) {
      console.error(`Stock decrement failed for product ${item.product_id}:`, rpcError);
    }
  }
}

async function sendConfirmationEmail(orderId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-shop-order-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!res.ok) {
      console.error('send-shop-order-email failed:', await res.text());
    }
  } catch (error) {
    console.error('Error invoking send-shop-order-email:', error);
  }
}
