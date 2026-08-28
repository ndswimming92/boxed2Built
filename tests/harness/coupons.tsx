/**
 * Test harness for the two ends of a coupon code: the public quote form that
 * takes one, and the admin page that makes one.
 *
 * Both live behind things a smoke test cannot reach — the admin page behind an
 * auth guard, the form behind a page of marketing — but what the specs check is
 * decided by the rows Supabase returns, so mounting the shipped components
 * against stubbed REST responses exercises the real pricing and the real
 * service calls. `?view=admin` picks the admin page.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import ContactForm from '../../src/components/ContactForm';
import CouponsPage from '../../src/pages/admin/CouponsPage';

function Harness() {
  const [params] = useSearchParams();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {params.get('view') === 'admin' ? <CouponsPage /> : <ContactForm />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/${window.location.search}`]}>
    <Harness />
  </MemoryRouter>,
);
