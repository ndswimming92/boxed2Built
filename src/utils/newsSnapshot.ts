import type { NewsItem } from '../types/news';
import { isNewsExpired } from './news.ts';

/**
 * The last first page the visitor was shown for each view, kept in their own
 * browser. If a later load fails (the database is struggling, or they lost
 * signal), the page can show that instead of an error. It is only ever a
 * fallback: a successful load always wins and replaces it.
 */

const STORAGE_KEY = 'boxed2built.news.last-good.v1';
/** Filter combinations are many; only the most recent few are worth keeping. */
const MAX_VIEWS = 6;
/** Older than this is more likely to mislead than to help. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface NewsSnapshot {
  items: NewsItem[];
  total: number | null;
  savedAt: number;
}

type SnapshotMap = Record<string, NewsSnapshot>;

function readAll(storage: Pick<Storage, 'getItem'>): SnapshotMap {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SnapshotMap) : {};
  } catch {
    return {};
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Blocked or unavailable storage (private windows, strict settings).
    return null;
  }
}

export function saveSnapshot(
  viewKey: string,
  items: NewsItem[],
  total: number | null,
  now: number = Date.now(),
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const all = readAll(storage);
    // A successful but empty answer is the truth now (the last sale was
    // unpublished or ended), so the old copy must not come back later.
    if (items.length === 0) delete all[viewKey];
    else all[viewKey] = { items, total, savedAt: now };
    const newest = Object.entries(all)
      .sort(([, a], [, b]) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .slice(0, MAX_VIEWS);
    storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch {
    // Full or unavailable: the snapshot is a nicety, never worth an error.
  }
}

/**
 * The saved page for this view, minus sales that have ended since. Null when
 * there is none, it is too old, or nothing in it is still current.
 */
export function loadSnapshot(
  viewKey: string,
  now: number = Date.now(),
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): NewsSnapshot | null {
  if (!storage) return null;
  const saved = readAll(storage)[viewKey];
  if (!saved || !Array.isArray(saved.items) || typeof saved.savedAt !== 'number') return null;
  if (now - saved.savedAt > MAX_AGE_MS) return null;

  const items = saved.items.filter((item) => !isNewsExpired(item, new Date(now)));
  if (items.length === 0) return null;
  return { items, total: null, savedAt: saved.savedAt };
}
