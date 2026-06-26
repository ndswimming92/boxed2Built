import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { CompleteBusinessData } from '../lib/supabase';
import { fetchBusinessData, primeBusinessDataCache } from '../hooks/businessDataStore';

export interface BusinessDataContextValue {
  data: CompleteBusinessData | null;
  loading: boolean;
  error: Error | null;
}

const BusinessDataContext = createContext<BusinessDataContextValue | undefined>(undefined);

/**
 * Returns the shared business data when a provider is mounted, or `undefined`
 * when there is no provider (e.g. admin/portal routes) so consumers can fall
 * back to their own fetch.
 */
export const useBusinessDataContext = (): BusinessDataContextValue | undefined =>
  useContext(BusinessDataContext);

interface BusinessDataProviderProps {
  /** Build-time route loader payload, used for instant first paint. */
  initialData?: CompleteBusinessData | null;
  children: ReactNode;
}

export function BusinessDataProvider({ initialData, children }: BusinessDataProviderProps) {
  const [data, setData] = useState<CompleteBusinessData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<Error | null>(null);
  const revalidatedRef = useRef(false);

  useEffect(() => {
    if (revalidatedRef.current) return;
    revalidatedRef.current = true;

    // Make the loader payload available to any non-context consumer too.
    if (initialData) primeBusinessDataCache(initialData);

    let active = true;

    // Stale-while-revalidate: when we already have loader data we paint it
    // immediately and refresh in the background (no loading flash); otherwise
    // this is the initial blocking fetch.
    fetchBusinessData(Boolean(initialData))
      .then((fresh) => {
        if (!active || !fresh) return;
        setData(fresh);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Error loading business data:', err);
        // Keep showing initialData if present; only surface the error when we
        // have nothing else to render.
        if (!initialData) setError(err as Error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialData]);

  return (
    <BusinessDataContext.Provider value={{ data, loading, error }}>
      {children}
    </BusinessDataContext.Provider>
  );
}
