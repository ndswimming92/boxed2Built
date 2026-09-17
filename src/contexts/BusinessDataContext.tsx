import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
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

  const stableSetData = useCallback((fresh: CompleteBusinessData) => {
    setData((prev) => {
      if (!prev) return fresh;
      if (
        prev.info.id === fresh.info.id &&
        prev.info.updated_at === fresh.info.updated_at &&
        prev.info.total_client_hours_saved === fresh.info.total_client_hours_saved &&
        prev.reviews.length === fresh.reviews.length &&
        prev.services.length === fresh.services.length &&
        prev.serviceAreas.length === fresh.serviceAreas.length &&
        prev.businessHours.length === fresh.businessHours.length &&
        prev.paymentMethods.length === fresh.paymentMethods.length &&
        prev.socialMedia.length === fresh.socialMedia.length &&
        prev.attributes.length === fresh.attributes.length &&
        prev.reviews[0]?.id === fresh.reviews[0]?.id
      ) {
        return prev;
      }
      return fresh;
    });
  }, []);

  useEffect(() => {
    if (revalidatedRef.current) return;
    revalidatedRef.current = true;

    if (initialData) primeBusinessDataCache(initialData);

    let active = true;

    fetchBusinessData(Boolean(initialData))
      .then((fresh) => {
        if (!active || !fresh) return;
        stableSetData(fresh);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Error loading business data:', err);
        if (!initialData) setError(err as Error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialData, stableSetData]);

  return (
    <BusinessDataContext.Provider value={{ data, loading, error }}>
      {children}
    </BusinessDataContext.Provider>
  );
}
