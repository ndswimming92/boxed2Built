import { useLoaderData } from 'react-router-dom';
import type { CompleteBusinessData } from '../lib/supabase';
import { buildFallbackData } from '../loaders/businessDataLoader';

let cachedFallback: CompleteBusinessData | null = null;

/**
 * Loader data can be null on the client: vite-react-ssg resolves route data
 * from a per-build static manifest, and a path missing from it (or a tab that
 * predates the latest deploy) yields null instead of the build-time data.
 * Fall back to the same static business data the SSG build uses so pages
 * render instead of crashing on a destructure of null.
 */
export function useBusinessLoaderData(): CompleteBusinessData {
  const data = useLoaderData() as { businessData?: CompleteBusinessData } | null | undefined;
  if (data?.businessData) return data.businessData;
  cachedFallback ??= buildFallbackData();
  return cachedFallback;
}
