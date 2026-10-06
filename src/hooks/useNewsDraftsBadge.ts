import { useEffect, useState } from 'react';
import { getDraftNewsCount, NEWS_DRAFTS_CHANGED_EVENT } from '../services/newsService';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * How many news items are waiting for approval. Drafts arrive once a day from
 * the scheduled news check, so a slow poll is plenty; approving or rejecting
 * from the News Feed page refreshes it immediately via a window event.
 */
export function useNewsDraftsBadge(): number {
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const count = await getDraftNewsCount();
        if (!cancelled) setDraftCount(count);
      } catch {
        // A failed count is not worth a banner — no badge, no noise.
        if (!cancelled) setDraftCount(0);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener(NEWS_DRAFTS_CHANGED_EVENT, poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(NEWS_DRAFTS_CHANGED_EVENT, poll);
    };
  }, []);

  return draftCount;
}
