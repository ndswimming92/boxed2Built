/**
 * Test harness for the admin Partner Leads screen: the shipped page mounted
 * against stubbed Supabase responses, with the organization id the page would
 * otherwise take from the signed-in admin. Not part of the app build.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { PartnerLeadsView } from '../../src/pages/admin/PartnerLeadsPage';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-slate-50 p-6">
    <PartnerLeadsView
      organizationId={new URLSearchParams(window.location.search).get('org') === 'none' ? null : 'org-1'}
    />
  </div>,
);
