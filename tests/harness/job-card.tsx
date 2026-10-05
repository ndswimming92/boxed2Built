/**
 * Test harness for the admin job card and the email panels that hang off it.
 *
 * The Jobs page sits behind an auth guard, so a smoke test cannot reach the real
 * one. What the specs check — the badges, the money, the drive-time panel, the
 * reminder and follow-up emails — is decided by the rows Supabase returns and
 * the answers the edge functions give, so mounting the shipped components
 * against stubbed network responses exercises the real rendering, the real
 * service calls and the real headers the browser sends.
 *
 * `?view=` picks what to mount:
 *   followup     the post-job follow-up panel on its own
 *   client       the client profile modal, where the reminder and follow-up
 *                panels live for each of a customer's jobs
 *   bookings     the Bookings page, whose rows carry the same drive-time card
 *   portal-jobs  the customer portal's job list
 *   portal-job   the customer portal's job detail page
 * Anything else mounts the admin Jobs page.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { PrivacyModeProvider } from '../../src/contexts/PrivacyModeContext';
import JobsPage from '../../src/pages/admin/JobsPage';
import JobFollowupCard from '../../src/components/admin/JobFollowupCard';
import ClientDetailModal from '../../src/components/admin/ClientDetailModal';
import BookingsPage from '../../src/pages/admin/BookingsPage';
import PortalJobsPage from '../../src/pages/portal/JobsPage';
import PortalJobDetailPage from '../../src/pages/portal/JobDetailPage';

const CLIENT = {
  id: 'client-1',
  organization_id: 'org-1',
  name: 'Kurt Zollner',
  email: 'kjzollner21@yahoo.com',
  phone: '(423) 368-3950',
  address: '2014 Beamon Drive Franklin, TN 37064',
  client_status: 'active',
  client_value_tier: 'high_value',
  marketing_email_opt_in: true,
  opt_in_date: '2026-09-11T12:00:00Z',
  opt_out_date: null,
  last_campaign_date: null,
  first_contact_date: '2026-09-11T12:00:00Z',
  last_contact_date: null,
  last_job_date: '2026-09-26',
  total_revenue: 300,
  job_count: 1,
  average_job_value: 300,
  source: 'Contact Form',
  tags: [],
  preferences_token: 'token',
  is_test: false,
  referral_code: null,
  referred_by_client_id: null,
  referral_credit_balance: 0,
  created_at: '2026-09-11T12:00:00Z',
  updated_at: '2026-09-11T12:00:00Z',
};

function Harness() {
  const [params] = useSearchParams();

  const view = params.get('view');
  const location = useLocation();

  // Decided by the path, not the query: following a link inside the portal
  // moves the path and drops `?view=`.
  if (location.pathname.startsWith('/portal')) {
    // The portal pages bring their own layout and are routed by id.
    return (
      <Routes>
        <Route path="/portal/jobs" element={<PortalJobsPage />} />
        <Route path="/portal/jobs/:id" element={<PortalJobDetailPage />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {view === 'followup' ? (
        <JobFollowupCard jobId="job-1" clientName="Kurt Zollner" />
      ) : view === 'client' ? (
        <ClientDetailModal client={CLIENT as never} onClose={() => undefined} />
      ) : view === 'bookings' ? (
        <BookingsPage />
      ) : (
        <JobsPage />
      )}
    </div>
  );
}

const view = new URLSearchParams(window.location.search).get('view');
const start =
  view === 'portal-jobs' ? '/portal/jobs' : view === 'portal-job' ? '/portal/jobs/job-1' : '/';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`${start}${window.location.search}`]}>
    <AuthProvider>
      <PrivacyModeProvider>
        <Harness />
      </PrivacyModeProvider>
    </AuthProvider>
  </MemoryRouter>,
);
