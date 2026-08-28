/**
 * Test harness for the admin Inquiries page.
 *
 * The page sits behind an auth guard, so a smoke test cannot reach the real
 * one. What the specs cover — which inquiries the working list holds on to and
 * which it lets go of — is decided entirely by the rows Supabase returns, so
 * mounting the shipped page against stubbed REST responses exercises the real
 * filtering, the real card actions and the real service calls.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import InquiriesPage from '../../src/pages/admin/InquiriesPage';

function Harness() {
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-slate-50 p-6">
        <InquiriesPage />
      </div>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
