import { useEffect, useState } from 'react';
import { getSocialConversations } from '../services/apiPlatformService';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useSocialMessagesBadge(): number {
  const [needsReplyCount, setNeedsReplyCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await getSocialConversations();
        if (!cancelled) setNeedsReplyCount(result.needs_reply_count);
      } catch {
        // Not connected yet, or a transient Graph API error — no badge, no noise.
        if (!cancelled) setNeedsReplyCount(0);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return needsReplyCount;
}
