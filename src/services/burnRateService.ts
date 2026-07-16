import { supabase } from '../lib/supabase';

/** ────────────────────────────────────────────────────────────────────────────
 *  Burn-Rate & Subscription service
 *
 *  Powers the Admin "Burn Rate" page: how long the current cash balance lasts
 *  given all recurring subscriptions and when they are due.
 *  -------------------------------------------------------------------------- */

export type BillingCycle =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly';

export interface Subscription {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  amount: number;
  billing_cycle: BillingCycle;
  next_due_date: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BalanceSnapshot {
  id: string;
  business_id: string;
  balance: number;
  note: string | null;
  recorded_at: string;
  created_at: string;
}

export const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannually', label: 'Every 6 months' },
  { value: 'yearly', label: 'Yearly' },
];

const DAYS_PER_YEAR = 365.25;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12; // ~30.44

/** How many times per year a given billing cycle charges. */
export function chargesPerYear(cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':
      return 52;
    case 'biweekly':
      return 26;
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'semiannually':
      return 2;
    case 'yearly':
      return 1;
    default:
      return 12;
  }
}

/** Normalize a subscription's cost to an equivalent monthly amount. */
export function monthlyAmount(sub: Pick<Subscription, 'amount' | 'billing_cycle'>): number {
  return (sub.amount * chargesPerYear(sub.billing_cycle)) / 12;
}

/** Normalize a subscription's cost to an equivalent annual amount. */
export function annualAmount(sub: Pick<Subscription, 'amount' | 'billing_cycle'>): number {
  return sub.amount * chargesPerYear(sub.billing_cycle);
}

export const cycleLabel = (cycle: BillingCycle): string =>
  BILLING_CYCLES.find((c) => c.value === cycle)?.label ?? cycle;

/** ── Date helpers (date-only, UTC to avoid timezone drift) ─────────────────── */

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  // Clamp to the last day of the resulting month (e.g. Jan 31 + 1mo -> Feb 28)
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

/** Advance a date by one billing interval. */
function advance(d: Date, cycle: BillingCycle): Date {
  switch (cycle) {
    case 'weekly':
      return addDays(d, 7);
    case 'biweekly':
      return addDays(d, 14);
    case 'monthly':
      return addMonths(d, 1);
    case 'quarterly':
      return addMonths(d, 3);
    case 'semiannually':
      return addMonths(d, 6);
    case 'yearly':
      return addMonths(d, 12);
    default:
      return addMonths(d, 1);
  }
}

export interface ChargeEvent {
  date: Date;
  amount: number;
  subscriptionId: string;
  name: string;
}

/**
 * Enumerate the individual charge events for one subscription between `from`
 * and `to` (inclusive of `from`, exclusive of dates after `to`). If the
 * subscription has no next_due_date, we assume its first charge lands one full
 * interval from today; if the recorded due date is in the past we roll it
 * forward to the next occurrence on/after `from`.
 */
export function enumerateCharges(
  sub: Subscription,
  from: Date,
  to: Date
): ChargeEvent[] {
  const events: ChargeEvent[] = [];
  if (!sub.is_active || sub.amount <= 0) return events;

  let cursor: Date;
  if (sub.next_due_date) {
    cursor = parseDateOnly(sub.next_due_date);
    // Roll forward past occurrences to the first one on/after `from`.
    let guard = 0;
    while (cursor < from && guard < 5000) {
      cursor = advance(cursor, sub.billing_cycle);
      guard += 1;
    }
  } else {
    cursor = advance(from, sub.billing_cycle);
  }

  let guard = 0;
  while (cursor <= to && guard < 5000) {
    events.push({
      date: toDateOnly(cursor),
      amount: sub.amount,
      subscriptionId: sub.id,
      name: sub.name,
    });
    cursor = advance(cursor, sub.billing_cycle);
    guard += 1;
  }

  return events;
}

export interface BurnMetrics {
  currentBalance: number;
  monthlyBurn: number;
  annualBurn: number;
  weeklyBurn: number;
  dailyBurn: number;
  activeCount: number;
  runwayDays: number | null; // null = effectively infinite (no burn)
  runwayMonths: number | null;
  zeroDate: Date | null; // scheduled date the balance is depleted
}

export interface BurndownPoint {
  label: string;
  date: string;
  balance: number;
  [key: string]: string | number;
}

export interface UpcomingMonthPoint {
  label: string;
  month: string;
  amount: number;
  [key: string]: string | number;
}

export interface SubscriptionCostSlice {
  id: string;
  name: string;
  monthly: number;
  annual: number;
  billing_cycle: BillingCycle;
  [key: string]: string | number;
}

/** Aggregate average burn metrics from active subscriptions + current balance. */
export function computeBurnMetrics(
  subscriptions: Subscription[],
  currentBalance: number
): BurnMetrics {
  const active = subscriptions.filter((s) => s.is_active);
  const monthlyBurn = active.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const annualBurn = monthlyBurn * 12;
  const weeklyBurn = annualBurn / 52;
  const dailyBurn = annualBurn / DAYS_PER_YEAR;

  const projection = projectBurndown(subscriptions, currentBalance);

  let runwayDays: number | null = null;
  let runwayMonths: number | null = null;
  if (projection.zeroDate) {
    runwayDays = Math.max(
      0,
      Math.round((projection.zeroDate.getTime() - todayDateOnly().getTime()) / 86_400_000)
    );
    runwayMonths = runwayDays / DAYS_PER_MONTH;
  }

  return {
    currentBalance,
    monthlyBurn,
    annualBurn,
    weeklyBurn,
    dailyBurn,
    activeCount: active.length,
    runwayDays,
    runwayMonths,
    zeroDate: projection.zeroDate,
  };
}

/**
 * Build a schedule-accurate burndown of the balance over time. Charges are
 * enumerated from their real due dates, so the line reflects exactly when money
 * leaves (e.g. an annual renewal shows as a single step). Returns monthly
 * sample points plus the exact date the balance first hits zero.
 */
export function projectBurndown(
  subscriptions: Subscription[],
  currentBalance: number,
  maxMonths = 60
): { points: BurndownPoint[]; zeroDate: Date | null } {
  const start = todayDateOnly();
  const horizon = addMonths(start, maxMonths);

  const active = subscriptions.filter((s) => s.is_active && s.amount > 0);

  // Gather and sort every charge event in the horizon.
  const events: ChargeEvent[] = [];
  active.forEach((sub) => {
    events.push(...enumerateCharges(sub, start, horizon));
  });
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Find the exact zero-crossing date by walking the sorted events.
  let zeroDate: Date | null = null;
  let running = currentBalance;
  for (const ev of events) {
    running -= ev.amount;
    if (running <= 0) {
      zeroDate = ev.date;
      break;
    }
  }

  // Build monthly sample points: balance at each month boundary = starting
  // balance minus all charges that have occurred on/before that boundary.
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

  const points: BurndownPoint[] = [];
  const totalMonths = zeroDate
    ? Math.min(
        maxMonths,
        Math.ceil((zeroDate.getTime() - start.getTime()) / (DAYS_PER_MONTH * 86_400_000)) + 1
      )
    : Math.min(maxMonths, 12);

  for (let m = 0; m <= totalMonths; m += 1) {
    const boundary = addMonths(start, m);
    const spent = events
      .filter((ev) => ev.date <= boundary)
      .reduce((sum, ev) => sum + ev.amount, 0);
    const balance = currentBalance - spent;
    points.push({
      label: m === 0 ? 'Now' : monthFormatter.format(boundary),
      date: formatISODate(boundary),
      balance: Math.max(0, Math.round(balance * 100) / 100),
    });
    if (balance <= 0) break;
  }

  return { points, zeroDate };
}

/**
 * Sum the actual scheduled charges landing in each of the next `months` months,
 * bucketed by calendar month. Answers "what leaves my account and when".
 */
export function upcomingPayments(
  subscriptions: Subscription[],
  months = 12
): UpcomingMonthPoint[] {
  const start = todayDateOnly();
  const startOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = addMonths(startOfMonth, months);

  const buckets: Record<string, number> = {};
  const order: string[] = [];
  const labelFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

  for (let m = 0; m < months; m += 1) {
    const d = addMonths(startOfMonth, m);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets[key] = 0;
    order.push(key);
  }

  subscriptions
    .filter((s) => s.is_active && s.amount > 0)
    .forEach((sub) => {
      enumerateCharges(sub, start, end).forEach((ev) => {
        const key = `${ev.date.getUTCFullYear()}-${String(ev.date.getUTCMonth() + 1).padStart(2, '0')}`;
        if (key in buckets) buckets[key] += ev.amount;
      });
    });

  return order.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return {
      label: labelFormatter.format(d),
      month: key,
      amount: Math.round(buckets[key] * 100) / 100,
    };
  });
}

/** Per-subscription monthly-normalized cost, largest first — for the donut. */
export function subscriptionCostBreakdown(subscriptions: Subscription[]): SubscriptionCostSlice[] {
  return subscriptions
    .filter((s) => s.is_active && s.amount > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      monthly: Math.round(monthlyAmount(s) * 100) / 100,
      annual: Math.round(annualAmount(s) * 100) / 100,
      billing_cycle: s.billing_cycle,
    }))
    .sort((a, b) => b.monthly - a.monthly);
}

/** ── Subscriptions CRUD ────────────────────────────────────────────────────── */

export async function getSubscriptions(businessId: string): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }
  return data || [];
}

export async function createSubscription(
  subscription: Partial<Subscription>
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .insert([subscription])
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription:', error);
    return null;
  }
  return data;
}

export async function updateSubscription(
  id: string,
  updates: Partial<Subscription>
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating subscription:', error);
    return null;
  }
  return data;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_subscriptions')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting subscription:', error);
    return false;
  }
  return true;
}

/** ── Balance snapshots ─────────────────────────────────────────────────────── */

export async function getLatestBalance(businessId: string): Promise<BalanceSnapshot | null> {
  const { data, error } = await supabase
    .from('business_balance_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest balance:', error);
    return null;
  }
  return data;
}

export async function getBalanceHistory(
  businessId: string,
  limit = 24
): Promise<BalanceSnapshot[]> {
  const { data, error } = await supabase
    .from('business_balance_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching balance history:', error);
    return [];
  }
  // Return chronological (oldest first) for charting.
  return (data || []).slice().reverse();
}

export async function recordBalance(
  snapshot: Partial<BalanceSnapshot>
): Promise<BalanceSnapshot | null> {
  const { data, error } = await supabase
    .from('business_balance_snapshots')
    .insert([snapshot])
    .select()
    .single();

  if (error) {
    console.error('Error recording balance:', error);
    return null;
  }
  return data;
}
