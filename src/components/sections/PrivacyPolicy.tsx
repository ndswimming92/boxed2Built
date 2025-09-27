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
          <li>Analytics Data: Website usage patterns, page views, session duration, and user interactions collected through Google Analytics 4 and Microsoft Clarity.</li>
          <li>Technical Data: Device type, operating system, screen resolution, and browsing behavior for website optimization purposes.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
        <p className="mb-4">We use your information to provide professional furniture assembly services:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Provide and schedule furniture assembly services in Spring Hill and surrounding Tennessee areas</li>
          <li>Send quotes for IKEA, Target, Walmart and other furniture assembly projects</li>
          <li>Send service updates and appointment confirmations</li>
          <li>Improve our furniture assembly website and service offerings using analytics data</li>
          <li>Analyze website performance and user experience through Google Analytics 4 and Microsoft Clarity</li>
          <li>Understand customer preferences and optimize our online presence</li>
          <li>Send promotional offers for furniture assembly services (only if you opt in)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. How We Share Your Information</h2>
        <p className="mb-4">We do not sell or rent your personal information. We may share it with:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>Service providers assisting with our furniture assembly business operations</li>
          <li>Google (through Google Analytics 4) and Microsoft (through Clarity) for website analytics purposes</li>
          <li>Third-party analytics providers to help us understand website usage and improve our services</li>
          <li>Law enforcement if required by Tennessee state law or federal law</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Note: Google Analytics and Microsoft Clarity have their own privacy policies and data handling practices. 
          We recommend reviewing their privacy policies for more information about how they process data.
        </p>
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
        <div>
          <p className="mb-4">We use cookies and similar technologies to analyze site traffic, improve performance, and enhance user experience on our furniture assembly website.</p>
          
          <h3 className="text-lg font-semibold mb-2">Analytics Services We Use:</h3>
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Google Analytics 4 (GA4)</h4>
            <p className="mb-2">We use Google Analytics 4 to understand how visitors interact with our furniture assembly website. GA4 collects:</p>
            <ul className="list-disc pl-6 mb-3">
              <li>Page views and session data</li>
              <li>User engagement metrics</li>
              <li>Traffic sources and referral information</li>
              <li>Device and browser information</li>
              <li>Geographic location (city/region level)</li>
            </ul>
            <p className="text-sm text-gray-600 mb-3">
              Google Analytics uses cookies to track your activity. You can opt out of Google Analytics by installing the 
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline"> Google Analytics Opt-out Browser Add-on</a>.
            </p>
          </div>
          
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Microsoft Clarity</h4>
            <p className="mb-2">We use Microsoft Clarity to understand user behavior and improve our website experience. Clarity collects:</p>
            <ul className="list-disc pl-6 mb-3">
              <li>Session recordings (anonymized)</li>
              <li>Heatmaps showing where users click and scroll</li>
              <li>User journey and navigation patterns</li>
              <li>Performance metrics and error tracking</li>
            </ul>
            <p className="text-sm text-gray-600 mb-3">
              Microsoft Clarity does not collect personally identifiable information. You can learn more about Clarity's privacy practices in 
              <a href="https://privacy.microsoft.com/en-us/privacystatement" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline"> Microsoft's Privacy Statement</a>.
            </p>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">Managing Your Preferences:</h3>
          <p className="mb-2">You can control cookies and tracking through:</p>
          <ul className="list-disc pl-6">
            <li>Your browser settings to block or delete cookies</li>
            <li>Opting out of Google Analytics using their browser add-on</li>
            <li>Using "Do Not Track" browser settings</li>
            <li>Contacting us to request data deletion</li>
          </ul>
        </div>
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
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-700 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+19316741196" className="text-blue-700 hover:text-blue-800 underline">(931) 674-1196</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
        </ul>
      </section>
    </div>
  );
};

export default PrivacyPolicy;