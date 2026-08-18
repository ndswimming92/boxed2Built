import { supabase } from '../lib/supabase';

export interface AdminNotification {
  id: string;
  organization_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

export async function getUnreadNotifications(): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
  return data ?? [];
}

export async function getRecentNotifications(limit = 30): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}
