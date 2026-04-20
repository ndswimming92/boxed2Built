import { useCallback, useEffect, useState } from 'react';
import {
  AppBranding,
  ADMIN_BRANDING_DEFAULTS,
  fetchAdminBranding,
} from '../services/brandingService';

type State = {
  branding: AppBranding | null;
  loading: boolean;
  error: string | null;
};

export function useAdminBranding() {
  const [state, setState] = useState<State>({ branding: null, loading: true, error: null });

  const refresh = useCallback(async (useCache = false) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const branding = await fetchAdminBranding(useCache);
      setState({ branding, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load branding';
      setState({
        branding: {
          id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...ADMIN_BRANDING_DEFAULTS,
        },
        loading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return { ...state, refresh };
}
