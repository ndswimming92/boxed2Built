import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FormInquiry, Goal } from '../lib/supabase';
import { getAvgResponseTime, getInquiryStats, getRecentInquiries, type ResponseTimeStats } from '../services/inquiryService';
import { getGoalStats, getUpcomingGoals } from '../services/goalsService';
import { getReferralStats } from '../services/clientService';
import { listScheduledEmails, type ScheduledEmailRow } from '../services/scheduledEmailsService';
import { parseJobDate } from '../services/analyticsCalculations';

export interface DashboardReminder {
  id: string;
  scheduled_date: string;
  reminder_type: string;
  admin_notes: string | null;
  job: {
    client_name: string;
    client_phone: string;
    job_type: string;
  } | null;
}

export interface DashboardData {
  services: number;
  serviceAreas: number;
  reviews: number;
  avgRating: number;
  inquiries: { total: number; pending: number; converted: number; archived: number; conversionRate: number };
  recentInquiries: FormInquiry[];
  goalStats: { totalGoals: number; completedGoals: number; overdueGoals: number; completionRate: number };
  upcomingGoals: Goal[];
  reminders: {
    /** The soonest few, for the list. Counts below cover every pending reminder. */
    items: DashboardReminder[];
    overdue: number;
    dueToday: number;
    upcoming: number;
  };
  responseTime: ResponseTimeStats | null;
}

export interface ReferralStats {
  totalCodes: number;
  totalReferrals: number;
  creditsIssuedAllTime: number;
  creditsRedeemedAllTime: number;
}

interface UseDashboardDataResult {
  business: { id: string; name: string } | null;
  data: DashboardData | null;
  scheduledEmails: ScheduledEmailRow[];
  referralStats: ReferralStats | null;
  /** True only until the first load settles. */
  loading: boolean;
  /** True during any later refresh, manual or automatic. */
  refreshing: boolean;
  /** Set when the latest load failed; `data` keeps the last good numbers. */
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/** How often the numbers are re-read while the tab is visible. */
const POLL_INTERVAL_MS = 60_000;
/** Coming back to the tab refreshes only if the data is at least this old. */
const STALE_AFTER_MS = 15_000;
/** Bursts of realtime events (a bulk edit, an import) collapse into one reload. */
const REALTIME_DEBOUNCE_MS = 800;

function count(result: { count: number | null; error: { message: string } | null }): number {
  if (result.error) throw new Error(result.error.message);
  return result.count || 0;
}

async function loadDashboardData(businessId: string): Promise<DashboardData> {
  const [
    servicesResult,
    serviceAreasResult,
    reviewsResult,
    inquiryStats,
    recentInquiries,
    goalStats,
    upcomingGoals,
    remindersResult,
    responseTime,
  ] = await Promise.all([
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('service_areas').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('customer_reviews').select('rating_value').eq('is_active', true),
    getInquiryStats(businessId),
    getRecentInquiries(businessId, 5),
    getGoalStats(businessId),
    getUpcomingGoals(businessId, 3),
    supabase
      .from('job_completion_reminders')
      .select('id, scheduled_date, reminder_type, admin_notes, job:jobs!job_id(client_name, client_phone, job_type)')
      .eq('status', 'pending')
      .order('scheduled_date', { ascending: true }),
    // Response time is a nice-to-have; never let it fail the whole dashboard.
    getAvgResponseTime(businessId).catch(() => null),
  ]);

  if (reviewsResult.error) throw new Error(reviewsResult.error.message);
  if (remindersResult.error) throw new Error(remindersResult.error.message);

  const reviews = reviewsResult.data || [];
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating_value, 0) / reviews.length
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminders = (remindersResult.data || []) as unknown as DashboardReminder[];
  let dueToday = 0;
  let overdue = 0;
  for (const reminder of reminders) {
    const day = parseJobDate(reminder.scheduled_date);
    if (!day) continue;
    day.setHours(0, 0, 0, 0);
    if (day.getTime() === today.getTime()) dueToday++;
    else if (day < today) overdue++;
  }

  return {
    services: count(servicesResult),
    serviceAreas: count(serviceAreasResult),
    reviews: reviews.length,
    avgRating: Math.round(avgRating * 10) / 10,
    inquiries: inquiryStats,
    recentInquiries,
    goalStats,
    upcomingGoals,
    reminders: {
      items: reminders.slice(0, 5),
      overdue,
      dueToday,
      upcoming: reminders.length - overdue - dueToday,
    },
    responseTime,
  };
}

/**
 * Everything the admin dashboard shows apart from jobs (which have their own
 * realtime hook), kept current without a page reload: re-read every minute
 * while the tab is visible, on returning to the tab, and whenever Supabase
 * Realtime reports a change to inquiries, reminders or reviews.
 *
 * A failed refresh never blanks the page — the last good numbers stay up and
 * `error` is set so the page can say they may be stale.
 */
export function useDashboardData(organizationId: string | null | undefined): UseDashboardDataResult {
  // Unique per instance: supabase.channel() returns an already-joined channel for a
  // repeated topic and .on() throws on it (see useRealtimeJobs).
  const instanceId = useId();
  const [business, setBusiness] = useState<{ id: string; name: string } | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailRow[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  // Starts true: the first load is already under way by the time anything renders.
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const businessRef = useRef<{ id: string; name: string } | null>(null);
  const inFlight = useRef(false);
  const lastLoadedAt = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      if (!businessRef.current) {
        const { data: businessInfo, error: businessError } = await supabase
          .from('business_info')
          .select('id, name')
          .eq('is_active', true)
          .maybeSingle();
        if (businessError) throw new Error(businessError.message);
        if (!businessInfo) {
          if (mounted.current) setError(null);
          return;
        }
        businessRef.current = businessInfo;
        if (mounted.current) setBusiness(businessInfo);
      }

      // Scheduled emails come from an edge function and sit outside the main load:
      // slow or failing, they must never hold up or fail the core numbers.
      listScheduledEmails()
        .then(rows => { if (mounted.current) setScheduledEmails(rows); })
        .catch(() => {});

      const next = await loadDashboardData(businessRef.current.id);
      if (!mounted.current) return;
      setData(next);
      setError(null);
      lastLoadedAt.current = Date.now();
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading dashboard:', err);
      if (mounted.current) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    // Deferred a tick so the load starts from a callback, not the effect body itself.
    const first = window.setTimeout(load, 0);

    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoadedAt.current > STALE_AFTER_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      mounted.current = false;
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load, refresh]);

  // Referral stats need the organization, which can arrive after the first load;
  // keying on lastUpdated re-reads them alongside every successful refresh.
  useEffect(() => {
    if (!organizationId) return;
    getReferralStats(organizationId)
      .then(stats => { if (mounted.current) setReferralStats(stats); })
      .catch(() => {});
  }, [organizationId, lastUpdated]);

  const businessId = business?.id ?? null;
  useEffect(() => {
    if (!businessId) return;

    let timer: number | undefined;
    const reloadSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, REALTIME_DEBOUNCE_MS);
    };

    // Tables not in the realtime publication simply never fire; polling covers them.
    const channel = supabase
      .channel(`dashboard-changes:${businessId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_inquiries', filter: `business_id=eq.${businessId}` }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_completion_reminders' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_reviews' }, reloadSoon)
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [businessId, instanceId, refresh]);

  return { business, data, scheduledEmails, referralStats, loading, refreshing, error, lastUpdated, refresh };
}
