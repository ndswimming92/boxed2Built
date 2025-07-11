import { useState, useEffect } from 'react';

interface UseAsyncDataOptions<T> {
  initialData?: T;
  delay?: number;
}

export const useAsyncData = <T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = [],
  options: UseAsyncDataOptions<T> = {}
) => {
  const { initialData, delay = 0 } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Add artificial delay if specified
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await asyncFunction();
        
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('An error occurred'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return { data, loading, error };
};