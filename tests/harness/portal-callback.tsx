/**
 * Test harness for the portal sign-in landing page.
 *
 * Everything this page decides turns on state a smoke test cannot reach for
 * real — whether a token hash redeems, whether a session exists yet, whether
 * the link was opened in the browser that asked for it. Mounting the shipped
 * page against stubbed auth responses exercises the real branching.
 *
 * The current path is rendered into the DOM because the page's whole output is
 * a redirect: there is nothing else to assert on.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import PortalCallbackPage from '../../src/pages/portal/CallbackPage';

function Location() {
  const location = useLocation();
  return (
    <div data-testid="location" style={{ position: 'fixed', bottom: 0, left: 0, padding: 4 }}>
      {location.pathname}
      {location.search}
    </div>
  );
}

function Stub({ name }: { name: string }) {
  return <div data-testid={`landed-${name}`}>{name}</div>;
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/portal/callback${window.location.search}`]}>
    <AuthProvider>
      <Location />
      <Routes>
        <Route path="/portal/callback" element={<PortalCallbackPage />} />
        <Route path="/portal/login" element={<Stub name="login" />} />
        <Route path="/portal/dashboard" element={<Stub name="dashboard" />} />
        <Route path="/portal/invoices" element={<Stub name="invoices" />} />
        <Route path="/admin/dashboard" element={<Stub name="admin" />} />
      </Routes>
    </AuthProvider>
  </MemoryRouter>,
);
