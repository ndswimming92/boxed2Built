/**
 * Test harness for the customer portal login page.
 *
 * The page itself is reachable in the app, but what the spec checks depends on
 * how Supabase Auth answers, and the interesting answers (an address that has
 * an account, one that does not, a rate limit) cannot be produced against a
 * real project on demand. Mounting the shipped page against stubbed auth
 * responses exercises the real send path, the real error mapping and the real
 * cooldown.
 *
 * `?next=` and `?email=` are forwarded into the router so the spec can drive
 * the prefill and the redirect-destination behaviour.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import PortalLoginPage from '../../src/pages/portal/LoginPage';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/portal/login${window.location.search}`]}>
    <AuthProvider>
      <PortalLoginPage />
    </AuthProvider>
  </MemoryRouter>,
);
