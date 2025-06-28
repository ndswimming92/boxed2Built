import React, { useEffect } from 'react';

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = 'Privacy Policy - Boxed2Built Furniture Assembly Service';
    
    // Update meta description for this page
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Privacy Policy for Boxed2Built furniture assembly services in Spring Hill, TN. Learn how we protect your personal information and data.');
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy - Boxed2Built Furniture Assembly</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: June 2, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
        <p className="mb-4">
          Boxed2Built furniture assembly service may collect the following types of personal information when you request our services in Spring Hill, TN and surrounding areas:
        </p>
        <ul className="list-disc pl-6 mt-2">
          <li>Contact Information: Name, email address, phone number, service address in Spring Hill, Columbia, Franklin, or surrounding Tennessee areas.</li>
          <li>Service Details: Furniture assembly requests, IKEA, Target, or Walmart furniture specifications.</li>
          <li>Device Information: IP address, browser type, website usage data for our furniture assembly website.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
        <p className="mb-4">We use your information to provide professional furniture assembly services:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Provide and schedule furniture assembly services in Spring Hill and surrounding Tennessee areas</li>
          <li>Send quotes for IKEA, Target, Walmart and other furniture assembly projects</li>
          <li>Send service updates and appointment confirmations</li>
          <li>Improve our furniture assembly website and service offerings</li>
          <li>Send promotional offers for furniture assembly services (only if you opt in)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. How We Share Your Information</h2>
        <p className="mb-4">We do not sell or rent your personal information. We may share it with:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Service providers assisting with our furniture assembly business operations</li>
          <li>Law enforcement if required by Tennessee state law or federal law</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Your Rights and Choices</h2>
        <p className="mb-4">Regarding your furniture assembly service information, you may:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Request a copy of your data related to our furniture assembly services</li>
          <li>Request deletion of your personal information</li>
          <li>Opt out of promotional communications about furniture assembly services at any time</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Cookies and Tracking Technologies</h2>
        <p>We use cookies and similar technologies to analyze site traffic, improve performance, and enhance user experience on our furniture assembly website.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. How We Protect Your Information</h2>
        <p>We use reasonable security measures such as encryption, secure forms, and restricted access to protect your furniture assembly service data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Children's Privacy</h2>
        <p>Our furniture assembly services are not directed to children under 13, and we do not knowingly collect data from minors.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with the updated date.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">9. Contact Boxed2Built</h2>
        <p className="mb-4">If you have questions about this privacy policy or our furniture assembly services in Spring Hill, TN, you can contact us at:</p>
        <ul className="list-none pl-0 mt-2">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-600 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+16154034538" className="text-blue-600 hover:text-blue-800 underline">(615) 403-4538</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
        </ul>
      </section>
    </div>
  );
};

export default PrivacyPolicy;