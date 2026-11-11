/**
 * Test harness for the admin Portal Adoption screen: the shipped page mounted
 * against stubbed Supabase responses. Not part of the app build.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import PortalAdoptionPage from '../../src/pages/admin/PortalAdoptionPage';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-slate-50 p-6">
    <PortalAdoptionPage />
  </div>,
);
