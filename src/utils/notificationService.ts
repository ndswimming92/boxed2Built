import { FormInquiry } from '../lib/supabase';

let notificationPermission: NotificationPermission = 'default';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    return permission === 'granted';
  }

  notificationPermission = Notification.permission;
  return false;
}

export function hasNotificationPermission(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function showNewInquiryNotification(inquiry: FormInquiry): void {
  if (!hasNotificationPermission()) {
    console.log('No notification permission');
    return;
  }

  const title = 'New Customer Inquiry!';
  const body = `${inquiry.client_name} - ${inquiry.furniture_type} (${inquiry.pieces} ${inquiry.pieces === 1 ? 'piece' : 'pieces'})${inquiry.estimated_price ? ` - Est: ${inquiry.estimated_price}` : ''}`;

  const options: NotificationOptions = {
    body,
    icon: '/Modern Minimalist Logo for Boxed2Built.png',
    badge: '/Modern Minimalist Logo for Boxed2Built.png',
    tag: `inquiry-${inquiry.id}`,
    requireInteraction: true,
    data: {
      inquiryId: inquiry.id,
      url: `/admin/inquiries`,
    },
  };

  try {
    const notification = new Notification(title, options);

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.href = '/admin/inquiries';
      notification.close();
    };

    playNotificationSound();
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

export function playNotificationSound(): void {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiP1O/TfTYIIHPC8OKZSw0PVqzn77FeFw1DnuH1tWgiCCmGzvDZhjkJIHDC8OKXSwwPVqzl77RYFg1EoOPztGkkCCmBzvDYhzkIIG/C8OOSSQwPVqzl77FdFgxFoOL3s2klCCl/z/DYgzkHIG/C8OOPSgwNVq3l77FeFgxFoOL3s2olCCl/z/DWhzkHIG/D8OOOSgwNVq3m77BfFgxFoOL3s2smCSl/z/DVhzkHIG/D8OONSgwNVqzm77FfFQxFoeL3s2smCCp/zvDWhzkHIG/D8OOOSgwNVq3m77FeFgxEoeL3smonCCl/zvDXhzkHIG/D8OONSgwNVq3m77BeFgxEoeL3smssCCl/zvDXhzkHIG/D8OONSgwNVq3m77BeFgxEoeL3smssCCl/zvDXhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smssCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwtCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smwsCCl/zvDWhzkHIG/D8OONSgwNVq3m77FeFQxEoeL3smws');
    audio.volume = 0.3;
    audio.play().catch((error) => {
      console.log('Could not play notification sound:', error);
    });
  } catch (error) {
    console.log('Error playing notification sound:', error);
  }
}

export function clearNotification(inquiryId: string): void {
  if ('Notification' in window) {
    const tag = `inquiry-${inquiryId}`;
    if ('getNotifications' in Notification) {
      (navigator as any).serviceWorker?.ready.then((registration: any) => {
        registration.getNotifications({ tag }).then((notifications: Notification[]) => {
          notifications.forEach((notification) => notification.close());
        });
      });
    }
  }
}

export function getNotificationStatus(): {
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
} {
  const supported = 'Notification' in window;
  const permission = supported ? Notification.permission : 'denied';
  const enabled = permission === 'granted';

  return {
    supported,
    permission,
    enabled,
  };
}
