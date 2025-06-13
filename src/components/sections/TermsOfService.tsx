import React, { useEffect } from 'react';

const TermsOfService = () => {
  useEffect(() => {
    document.title = 'Terms of Service - Boxed2Built';
    
    // Update meta description for this page
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Terms of Service for Boxed2Built furniture assembly services. Read our service terms and conditions.');
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: June 2, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
        <p>
          By using our services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. Services</h2>
        <p>
          Boxed2Built provides professional furniture assembly. We reserve the right to modify or discontinue any service at any time.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. Payment Terms</h2>
        <p>
          Payment is due upon completion of the service unless otherwise agreed. We accept major forms of payment including credit/debit cards and cash.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Cancellations</h2>
        <p>
          We request at least 24 hours' notice for cancellations. Late cancellations may be subject to a fee.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Liability</h2>
        <p>
          We are not responsible for damage due to pre-existing defects or misuse of assembled products. Our liability is limited to the cost of the service provided.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Changes to Terms</h2>
        <p>
          We may update these Terms of Service at any time. Continued use of the service after changes means you accept the new terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Contact Us</h2>
        <p>If you have questions about these Terms, contact us at:</p>
        <ul className="list-none pl-0 mt-2">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-600 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+16154034538" className="text-blue-600 hover:text-blue-800 underline">(615) 403-4538</a></li>
        </ul>
      </section>
    </div>
  );
};

export default TermsOfService;