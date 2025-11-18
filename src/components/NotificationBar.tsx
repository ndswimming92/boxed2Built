import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { NotificationBar as NotificationBarType } from '../lib/supabase';

interface NotificationBarProps {
  notification: NotificationBarType;
}

const STORAGE_KEY_PREFIX = 'notification_bar_dismissed_';

export default function NotificationBar({ notification }: NotificationBarProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${notification.id}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === 'true') {
      setIsDismissed(true);
    } else {
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(storageKey, 'true');
    }, 300);
  };

  if (isDismissed || !notification.is_enabled || !notification.message.trim()) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      style={{
        backgroundColor: notification.background_color,
        color: notification.text_color,
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3 gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm sm:text-base font-medium leading-relaxed">
              {notification.message}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Dismiss notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
