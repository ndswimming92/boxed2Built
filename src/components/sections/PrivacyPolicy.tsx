import React, { useEffect } from 'react';

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = 'Privacy Policy - Boxed2Built';
    
    // Update meta description for this page
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Privacy Policy for Boxed2Built furniture assembly services. Learn how we protect your personal information.');
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: June 2, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
        <p>We may collect the following types of personal information:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Contact Information: Name, email, phone number, address.</li>
          <li>Service Details: Furniture or service requests.</li>
          <li>Device Information: IP address, browser type, website usage data.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Provide and schedule services</li>
          <li>Send quotes and service updates</li>
          <li>Improve our website and service offerings</li>
          <li>Send promotional offers (only if you opt in)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. How We Share Your Information</h2>
        <p>We do not sell or rent your personal information. We may share it with:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Service providers assisting with business operations</li>
          <li>Law enforcement if required by law</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Your Rights and Choices</h2>
        <p>You may:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Request a copy of your data</li>
          <li>Request deletion of your personal information</li>
          <li>Opt out of promotional communications at any time</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Cookies and Tracking Technologies</h2>
        <p>We use cookies and similar technologies to analyze site traffic, improve performance, and enhance user experience.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. How We Protect Your Information</h2>
        <p>We use reasonable security measures such as encryption, secure forms, and restricted access to protect your data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Children's Privacy</h2>
        <p>Our services are not directed to children under 13, and we do not knowingly collect data from minors.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with the updated date.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">9. Contact Us</h2>
        <p>If you have questions about this policy, you can contact us at:</p>
        <ul className="list-none pl-0 mt-2">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-600 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+16154034538" className="text-blue-600 hover:text-blue-800 underline">(615) 403-4538</a></li>
        </ul>
      </section>
    </div>
  );
};

export default PrivacyPolicy;