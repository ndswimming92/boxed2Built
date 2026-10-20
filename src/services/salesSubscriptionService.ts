import { supabase } from '../lib/supabase';
import type { SaleSubscriber } from '../types/saleSubscriber';

/**
 * Sign-up and opt-out go through the `sales-subscription` edge function: the
 * table has no policies for visitors, so the function (service role) is the
 * only way in. The list read below is the admin screen, under RLS.
 */

async function callSubscription(body: Record<string, unknown>): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('We could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Something went wrong. Please try again.');
  }
}

/** `website` is the honeypot: a field visitors never see, left empty by real ones. */
export function subscribeToSales(input: { name: string; email: string; website?: string }): Promise<void> {
  return callSubscription({ action: 'subscribe', ...input });
}

export function unsubscribeFromSales(token: string): Promise<void> {
  return callSubscription({ action: 'unsubscribe', token });
}

const ADMIN_FETCH_SIZE = 1000;
const ADMIN_FETCH_MAX_REQUESTS = 200;

/** Everyone who ever signed up, newest first, active and unsubscribed alike. */
export async function getSaleSubscribers(): Promise<SaleSubscriber[]> {
  const rows: SaleSubscriber[] = [];

  for (let request = 0; request < ADMIN_FETCH_MAX_REQUESTS; request += 1) {
    const { data, error } = await supabase
      .from('sale_subscribers')
      .select('id, name, email, status, subscribed_at, unsubscribed_at')
      .order('subscribed_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + ADMIN_FETCH_SIZE - 1);

    if (error) {
      console.error('Error fetching sale subscribers:', error);
      throw new Error(`Failed to load subscribers: ${error.message}`);
    }

    const page = (data || []) as SaleSubscriber[];
    if (page.length === 0) break;
    rows.push(...page);
  }

  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}
