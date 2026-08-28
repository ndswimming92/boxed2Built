/**
 * Test harness for the public quote form — the one a customer fills in to ask
 * for service.
 *
 * The form ships inside a page of marketing and SEO chrome that a smoke test
 * has no reason to boot. What the specs check is decided entirely by the
 * requests the form makes on submit, so mounting the shipped component against
 * stubbed REST responses exercises the real validation, the real service calls
 * and the real confirmation screen.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ContactForm from '../../src/components/ContactForm';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/${window.location.search}`]}>
    <div className="min-h-screen bg-slate-50 p-6">
      <ContactForm />
    </div>
  </MemoryRouter>,
);
