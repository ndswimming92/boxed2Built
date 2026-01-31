import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { updateManifest } from '../utils/manifestManager';

export function useManifestManager(): void {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin');
    updateManifest(isAdminRoute);
  }, [location.pathname]);
}
