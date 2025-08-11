import React, { useEffect } from 'react';

const TermsOfService = () => {
  useEffect(() => {
    document.title = 'Terms of Service - Boxed2Built Furniture Assembly Service';
    
    // Update meta description for this page
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Terms of Service for Boxed2Built furniture assembly services in Spring Hill, TN. Read our service terms and conditions for IKEA, Target, Walmart furniture assembly.');
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Service - Boxed2Built Furniture Assembly</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: June 2, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
        <p>
          By using Boxed2Built furniture assembly services in Spring Hill, TN and surrounding Tennessee areas, you agree to be bound by these Terms of Service. If you do not agree, please do not use our furniture assembly services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. Furniture Assembly Services</h2>
        <p>
          Boxed2Built provides professional furniture assembly services for IKEA, Target, Walmart, and other major furniture brands in Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas. We reserve the right to modify or discontinue any service at any time.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. Payment Terms for Furniture Assembly</h2>
        <p>
          Payment for furniture assembly services is due upon completion unless otherwise agreed. We accept major forms of payment including credit/debit cards and cash for all furniture assembly projects.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Cancellations and Rescheduling</h2>
        <p>
          We request at least 24 hours' notice for cancellations of furniture assembly appointments. Late cancellations may be subject to a fee. Rescheduling is available when possible for Spring Hill area services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Liability and Furniture Assembly Warranty</h2>
        <p>
          We are not responsible for damage due to pre-existing defects in furniture or misuse of assembled products. Our liability for furniture assembly services is limited to the cost of the service provided. We guarantee professional assembly according to manufacturer specifications.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Service Area</h2>
        <p>
          Our furniture assembly services are available in Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas. Travel fees may apply for locations outside our primary service area.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Changes to Terms</h2>
        <p>
          We may update these Terms of Service at any time. Continued use of our furniture assembly services after changes means you accept the new terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Contact Boxed2Built</h2>
        <p className="mb-4">If you have questions about these Terms or our furniture assembly services in Spring Hill, TN, contact us at:</p>
        <ul className="list-none pl-0 mt-2">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-700 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+19316741196" className="text-blue-700 hover:text-blue-800 underline">(931) 674-1196</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
          <li>Services: IKEA Assembly, Target Furniture Assembly, Walmart Furniture Assembly, Professional Furniture Assembly</li>
        </ul>
      </section>
    </div>
  );
};

export default TermsOfService;