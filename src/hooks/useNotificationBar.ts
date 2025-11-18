import { useState, useEffect } from 'react';
import { getNotificationBar, NotificationBar } from '../lib/supabase';

export function useNotificationBar(businessId: string | null) {
  const [notification, setNotification] = useState<NotificationBar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const fetchNotification = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getNotificationBar(businessId);
        setNotification(data);
      } catch (err) {
        console.error('Error fetching notification bar:', err);
        setError(err instanceof Error ? err.message : 'Failed to load notification');
      } finally {
        setLoading(false);
      }
    };

    fetchNotification();
  }, [businessId]);

  return { notification, loading, error };
}
