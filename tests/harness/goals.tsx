/**
 * Test harness for the admin Business Goals page.
 *
 * The page sits behind an auth guard, so a smoke test cannot reach the real
 * one. Mounting the shipped page against stubbed Supabase responses exercises
 * the real grouping, the real in-place editor and the real complete/reopen flow.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import GoalsPage from '../../src/pages/admin/GoalsPage';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <GoalsPage />
  </div>,
);
