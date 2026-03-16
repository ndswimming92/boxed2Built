const STORAGE_KEY = 'portal_support_last_seen_admin_messages';

type LastSeenMap = Record<string, string>;

const safeParse = (value: string | null): LastSeenMap => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LastSeenMap;
  } catch {
    return {};
  }
};

export const getSupportLastSeenMap = (): LastSeenMap => {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

export const markSupportTicketAsSeen = (ticketId: string, adminTimestamp: string | null) => {
  if (typeof window === 'undefined' || !adminTimestamp) return;
  const map = getSupportLastSeenMap();
  map[ticketId] = adminTimestamp;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const hasUnreadSupportUpdate = (ticketId: string, adminTimestamp: string | null): boolean => {
  if (!adminTimestamp) return false;

  const seenTimestamp = getSupportLastSeenMap()[ticketId];
  if (!seenTimestamp) return true;

  return new Date(adminTimestamp).getTime() > new Date(seenTimestamp).getTime();
};
