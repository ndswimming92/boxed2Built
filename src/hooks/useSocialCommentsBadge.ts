import { useEffect, useState } from 'react';
import { getSocialComments } from '../services/apiPlatformService';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useSocialCommentsBadge(): number {
  const [unrepliedCount, setUnrepliedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await getSocialComments();
        if (!cancelled) setUnrepliedCount(result.unreplied_count);
      } catch {
        // Not connected yet, or a transient Graph API error — no badge, no noise.
        if (!cancelled) setUnrepliedCount(0);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return unrepliedCount;
}
