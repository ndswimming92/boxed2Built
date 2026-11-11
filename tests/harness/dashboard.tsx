/**
 * Test harness for the admin Dashboard page.
 *
 * The page sits behind an auth guard, so a smoke test cannot reach the real
 * one. Everything it shows is derived from what Supabase returns, so mounting
 * the shipped page against stubbed responses exercises the real data hook, the
 * real trend maths and the real layout.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { PrivacyModeProvider } from '../../src/contexts/PrivacyModeContext';
import DashboardPage from '../../src/pages/admin/DashboardPage';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AuthProvider>
      <PrivacyModeProvider>
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
          <DashboardPage />
        </div>
      </PrivacyModeProvider>
    </AuthProvider>
  </MemoryRouter>,
);
