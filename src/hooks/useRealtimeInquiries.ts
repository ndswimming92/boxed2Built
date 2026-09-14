import { useEffect, useId, useState } from 'react';
import { supabase, FormInquiry } from '../lib/supabase';
import { getInquiries, getUnviewedCount } from '../services/inquiryService';
import { showNewInquiryNotification } from '../utils/notificationService';

interface UseRealtimeInquiriesOptions {
  businessId: string | null;
  autoRefresh?: boolean;
  enableNotifications?: boolean;
  includeTestData?: boolean;
}

interface UseRealtimeInquiriesResult {
  inquiries: FormInquiry[];
  unviewedCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<FormInquiry[]>;
}

export function useRealtimeInquiries({
  businessId,
  autoRefresh = true,
  enableNotifications = false,
  includeTestData = false,
}: UseRealtimeInquiriesOptions): UseRealtimeInquiriesResult {
  // Every instance of this hook needs its own Realtime channel. supabase.channel()
  // returns an EXISTING channel when one is already registered under the same topic,
  // and RealtimeChannel.on() throws once that channel has joined — so a shared,
  // hardcoded topic crashes the second subscriber. AdminLayout's unviewed badge and
  // InquiriesPage both mount this hook at the same time, which made /admin/inquiries
  // fail every load. Do not collapse this back into a constant.
  const instanceId = useId();
  const [inquiries, setInquiries] = useState<FormInquiry[]>([]);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInquiries = async (): Promise<FormInquiry[]> => {
    if (!businessId) {
      setLoading(false);
      return [];
    }

    try {
      const data = await getInquiries(businessId, { includeTestData });
      setInquiries(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch inquiries');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchUnviewedCount = async () => {
    if (!businessId) return;

    try {
      const count = await getUnviewedCount(businessId);
      setUnviewedCount(count);
    } catch (err) {
      console.error('Error fetching unviewed count:', err);
    }
  };

  const refresh = async (): Promise<FormInquiry[]> => {
    const [latestInquiries] = await Promise.all([fetchInquiries(), fetchUnviewedCount()]);
    return latestInquiries;
  };

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    refresh();

    if (!autoRefresh) return;

    const channel = supabase
      .channel(`form_inquiries_changes:${businessId}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_inquiries',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          console.log('Inquiry change detected:', payload);

          if (payload.eventType === 'INSERT') {
            const newInquiry = payload.new as FormInquiry;

            if (enableNotifications) {
              console.log('Triggering notification for new inquiry:', newInquiry);
              showNewInquiryNotification(newInquiry);
            }

            refresh();
          } else if (payload.eventType === 'UPDATE') {
            refresh();
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setInquiries((prev) => prev.filter((inquiry) => inquiry.id !== deletedId));
            fetchUnviewedCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, autoRefresh, enableNotifications, includeTestData, instanceId]);

  return {
    inquiries,
    unviewedCount,
    loading,
    error,
    refresh,
  };
}
