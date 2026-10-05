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
 * `?view=followup` mounts the post-job follow-up panel on its own; it normally
 * lives inside the client profile modal, which is a lot of page to drag in for
 * one card. Anything else mounts the Jobs page.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { PrivacyModeProvider } from '../../src/contexts/PrivacyModeContext';
import JobsPage from '../../src/pages/admin/JobsPage';
import JobFollowupCard from '../../src/components/admin/JobFollowupCard';

function Harness() {
  const [params] = useSearchParams();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {params.get('view') === 'followup' ? (
        <JobFollowupCard jobId="job-1" clientName="Kurt Zollner" />
      ) : (
        <JobsPage />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/${window.location.search}`]}>
    <AuthProvider>
      <PrivacyModeProvider>
        <Harness />
      </PrivacyModeProvider>
    </AuthProvider>
  </MemoryRouter>,
);
