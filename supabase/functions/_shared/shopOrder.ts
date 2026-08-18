import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

interface MarkPaidParams {
  orderId: string;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}

/**
 * Flips a print shop order from `pending` to `paid`, decrements tracked stock,
 * sends the confirmation email, and creates an admin notification.
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
    return false;
  }

  await decrementStock(admin, orderId);
  await sendConfirmationEmail(orderId);
  await insertAdminNotification(admin, orderId);
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

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
}

async function insertAdminNotification(admin: SupabaseClient, orderId: string): Promise<void> {
  try {
    const { data: order } = await admin
      .from('shop_orders')
      .select('id, organization_id, order_number, customer_name, customer_email, customer_phone, fulfillment_method, total_cents')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return;

    const { data: items } = await admin
      .from('shop_order_items')
      .select('product_name, quantity, line_total_cents')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    const itemSummary = (items ?? [])
      .map((i) => `${i.product_name} x${i.quantity}`)
      .join(', ');

    const title = `New order ${order.order_number} — ${money(order.total_cents)}`;
    const body = `${order.customer_name} ordered: ${itemSummary}. ${order.fulfillment_method === 'pickup' ? 'Pickup' : 'Shipping'}.`;

    await admin.from('admin_notifications').insert({
      organization_id: order.organization_id,
      type: 'shop_order',
      title,
      body,
      link: '/admin/store-orders',
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        fulfillment_method: order.fulfillment_method,
        total_cents: order.total_cents,
        items: items ?? [],
      },
    });
  } catch (err) {
    console.error('Failed to insert admin notification:', err);
  }
}
