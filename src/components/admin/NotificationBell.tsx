import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ShoppingBag, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AnchoredPanel from '../ui/AnchoredPanel';
import {
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AdminNotification,
} from '../../services/adminNotificationService';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const typeIcons: Record<string, React.ElementType> = {
  shop_order: ShoppingBag,
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const load = async () => {
    const data = await getRecentNotifications(30);
    setNotifications(data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setNotifications((prev) => [payload.new as AdminNotification, ...prev].slice(0, 30));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClick = async (n: AdminNotification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="group relative p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[18px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="pointer-events-none hidden lg:block absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Notifications
        </span>
      </button>

      <AnchoredPanel
        anchorRef={buttonRef}
        open={open}
        onClose={() => setOpen(false)}
        width={384}
        maxHeight={448}
        align="right"
        backdrop
        role="dialog"
        aria-label="Notifications"
        className="bg-white rounded-xl shadow-xl border border-slate-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcons[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                    !n.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      n.type === 'shop_order'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-snug truncate ${
                          !n.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </AnchoredPanel>
    </div>
  );
}
