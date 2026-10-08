/**
 * Test harness for the admin Grants screen.
 *
 * The page sits behind the admin auth guard, which a smoke test cannot get
 * through, but everything it shows comes from the rows Supabase returns. So the
 * shipped component is mounted here against stubbed REST responses.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import GrantsPage from '../../src/pages/admin/GrantsPage';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-slate-50 p-6">
    <GrantsPage />
  </div>,
);
