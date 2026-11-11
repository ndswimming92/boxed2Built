/**
 * Test harness for the coupon popup on the home page.
 *
 * The home page itself is a page of marketing, SEO chrome and a three-second
 * opening animation. What the specs check is the popup's own behaviour — when
 * it appears, who has already seen it, and that claiming it applies the code
 * to the quote form — so this mounts the shipped popup beside the shipped
 * form, in the same arrangement the home page uses, against stubbed REST
 * responses.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ContactForm from '../../src/components/ContactForm';
import HomeCouponPopup from '../../src/components/HomeCouponPopup';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[`/${window.location.search}`]}>
    <div className="min-h-screen bg-slate-50 p-6">
      <HomeCouponPopup businessId="biz-1" />
      <section id="contact-form-section">
        <ContactForm />
      </section>
    </div>
  </MemoryRouter>,
);
