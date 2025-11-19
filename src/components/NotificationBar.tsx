import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { NotificationBar as NotificationBarType } from '../lib/supabase';
import { useNotificationBarContext } from '../contexts/NotificationBarContext';

const SCROLL_SPEEDS = {
  slow: '20s',
  medium: '12s',
  fast: '8s',
};

interface NotificationBarProps {
  notification: NotificationBarType;
}

const STORAGE_KEY_PREFIX = 'notification_bar_dismissed_';

export default function NotificationBar({ notification }: NotificationBarProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { setIsVisible: setContextVisible, setNotificationHeight } = useNotificationBarContext();
  const barRef = useRef<HTMLDivElement>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${notification.id}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === 'true') {
      setIsDismissed(true);
      setContextVisible(false);
      setNotificationHeight(0);
    } else {
      setTimeout(() => {
        setIsVisible(true);
        setContextVisible(true);
        if (barRef.current) {
          setNotificationHeight(barRef.current.offsetHeight);
        }
      }, 100);
    }
  }, [storageKey, setContextVisible, setNotificationHeight]);

  useEffect(() => {
    if (isVisible && barRef.current) {
      const updateHeight = () => {
        if (barRef.current) {
          setNotificationHeight(barRef.current.offsetHeight);
        }
      };

      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [isVisible, setNotificationHeight]);

  const handleDismiss = () => {
    setIsVisible(false);
    setContextVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(storageKey, 'true');
      setNotificationHeight(0);
    }, 300);
  };

  if (isDismissed || !notification.is_enabled || !notification.message.trim()) {
    return null;
  }

  const animationDuration = SCROLL_SPEEDS[notification.scroll_speed || 'medium'];

  return (
    <>
      <style>
        {`
          @keyframes scroll-notification-wrap {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .notification-scroll-wrapper {
              animation: none !important;
            }
            .notification-scroll-wrapper .notification-scroll-content:nth-child(2) {
              display: none;
            }
          }

          .notification-scroll-wrapper {
            display: flex;
            animation: scroll-notification-wrap ${animationDuration} linear infinite;
            will-change: transform;
          }

          .notification-scroll-content {
            display: inline-block;
            white-space: nowrap;
            padding-right: 4rem;
          }
        `}
      </style>
      <div
        ref={barRef}
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 transform ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
        style={{
          backgroundColor: notification.background_color,
          color: notification.text_color,
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex-1 relative overflow-hidden">
              {notification.enable_scroll_animation ? (
                <div className="notification-scroll-wrapper">
                  <span className="notification-scroll-content text-sm sm:text-base font-medium leading-relaxed">
                    {notification.message}
                  </span>
                  <span className="notification-scroll-content text-sm sm:text-base font-medium leading-relaxed" aria-hidden="true">
                    {notification.message}
                  </span>
                </div>
              ) : (
                <p className="text-sm sm:text-base font-medium leading-relaxed text-center">
                  {notification.message}
                </p>
              )}
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
    </>
  );
}
