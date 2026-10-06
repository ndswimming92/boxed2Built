/**
 * Test harness for the admin News Feed review screen.
 *
 * The page sits behind the admin auth guard, which a smoke test cannot get
 * through, but everything it decides — which tab an item is on, which actions
 * it offers, what it writes back — comes from the rows Supabase returns. So the
 * shipped component is mounted here against stubbed REST responses.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import NewsPage from '../../src/pages/admin/NewsPage';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-slate-50 p-6">
    <NewsPage />
  </div>,
);
