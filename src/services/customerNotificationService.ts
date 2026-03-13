import { supabase } from '../lib/supabase';
import { PortalServiceError } from './customerPortalService';

export type CustomerNotificationType =
  | 'job_scheduled'
  | 'job_completed'
  | 'invoice_issued'
  | 'invoice_paid'
  | 'reminder_sent'
  | 'job_action_request_approved'
  | 'job_action_request_rejected';

export type CustomerNotification = {
  id: string;
  customer_id: string;
  notification_type: CustomerNotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  is_important: boolean;
  created_at: string;
};

export type CustomerNotificationPreferences = {
  customer_id: string;
  email_enabled: boolean;
  important_only: boolean;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
};

const ensureSession = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new PortalServiceError('SESSION_EXPIRED', 'Your session has expired. Please sign in again to continue.');
  }
};

export const customerNotificationService = {
  async getMyNotifications(filter: 'all' | 'unread' | CustomerNotificationType = 'all') {
    await ensureSession();

    let query = supabase
      .from('customer_notifications')
      .select('id, customer_id, notification_type, payload, is_read, read_at, is_important, created_at')
      .order('created_at', { ascending: false });

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    }

    if (filter !== 'all' && filter !== 'unread') {
      query = query.eq('notification_type', filter);
    }

    const { data, error } = await query;
    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to fetch notifications: ${error.message}`);
    }

    return (data ?? []) as CustomerNotification[];
  },

  async getUnreadCount() {
    await ensureSession();

    const { count, error } = await supabase
      .from('customer_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to fetch unread count: ${error.message}`);
    }

    return count ?? 0;
  },

  async markAsRead(notificationId: string) {
    await ensureSession();

    const { error } = await supabase
      .from('customer_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to mark notification as read: ${error.message}`);
    }
  },

  async markAllAsRead() {
    await ensureSession();

    const { error } = await supabase
      .from('customer_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false);

    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to mark all notifications as read: ${error.message}`);
    }
  },

  async getMyPreferences() {
    await ensureSession();

    const { data: customerId, error: customerIdError } = await supabase.rpc('current_customer_id');
    if (customerIdError) {
      throw new PortalServiceError('UNKNOWN', `Failed to resolve customer context: ${customerIdError.message}`);
    }

    if (!customerId) return null;

    const { data, error } = await supabase
      .from('customer_notification_preferences')
      .select('customer_id, email_enabled, important_only, unsubscribe_token, unsubscribed_at')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to fetch notification preferences: ${error.message}`);
    }

    return data as CustomerNotificationPreferences | null;
  },

  async upsertMyPreferences(payload: { email_enabled: boolean; important_only: boolean; unsubscribed_at: string | null }) {
    await ensureSession();

    const { data: customerId, error: customerIdError } = await supabase.rpc('current_customer_id');
    if (customerIdError) {
      throw new PortalServiceError('UNKNOWN', `Failed to resolve customer context: ${customerIdError.message}`);
    }

    if (!customerId) {
      throw new PortalServiceError('NOT_FOUND', 'No linked customer record found for this portal account.');
    }

    const { error } = await supabase
      .from('customer_notification_preferences')
      .upsert({
        customer_id: customerId,
        email_enabled: payload.email_enabled,
        important_only: payload.important_only,
        unsubscribed_at: payload.unsubscribed_at,
      });

    if (error) {
      throw new PortalServiceError('UNKNOWN', `Failed to save notification preferences: ${error.message}`);
    }
  },
};
