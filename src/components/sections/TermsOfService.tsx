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
          Payment for furniture assembly services is due upon completion unless otherwise agreed. We accept major forms of payment including credit/debit cards (processed through Square), cash, and other electronic payment methods for all furniture assembly projects.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Payment Processing and Square Services</h2>
        <div>
          <h3 className="text-lg font-semibold mb-2">Square Payment Processing</h3>
          <p className="mb-4">
            We use Square, Inc. as our payment processor for credit and debit card transactions. By making a payment through Square, you agree to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Square's Terms of Service and Privacy Notice</li>
            <li>Provide accurate payment and billing information</li>
            <li>Allow Square to process and store your payment information as needed</li>
            <li>Square's fraud prevention and security measures</li>
          </ul>
          
          <h3 className="text-lg font-semibold mb-2">Payment Security and Disputes</h3>
          <p className="mb-4">
            Payment processing security and dispute resolution:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>All card payments are processed securely through Square's PCI DSS compliant systems</li>
            <li>We do not store complete credit card information on our systems</li>
            <li>Payment disputes should be directed to Square's customer support</li>
            <li>Chargebacks and refunds are subject to Square's policies and procedures</li>
            <li>You may be charged additional fees for disputed or failed payments</li>
          </ul>
          
          <h3 className="text-lg font-semibold mb-2">Refund Policy</h3>
          <p className="mb-4">
            Refunds for furniture assembly services:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Refunds are provided at our discretion for unsatisfactory work</li>
            <li>Payment processing fees may not be refundable</li>
            <li>Refund processing times depend on Square's payment processing schedule</li>
            <li>Partial refunds may be issued for partially completed work</li>
          </ul>
          
          <p className="text-sm text-gray-600">
            For more information about Square's payment processing terms, please review 
            <a href="https://squareup.com/legal/general/ua" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline"> Square's Terms of Service</a> and 
            <a href="https://squareup.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline"> Privacy Notice</a>.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Cancellations and Rescheduling</h2>
        <p>
          We request at least 24 hours' notice for cancellations of furniture assembly appointments. Late cancellations may be subject to a fee that will be processed through Square. Rescheduling is available when possible for Spring Hill area services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Liability and Furniture Assembly Warranty</h2>
        <p>
          We are not responsible for damage due to pre-existing defects in furniture or misuse of assembled products. Our liability for furniture assembly services is limited to the cost of the service provided. We guarantee professional assembly according to manufacturer specifications.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Affiliate Links and Third-Party Services</h2>
        <div>
          <h3 className="text-lg font-semibold mb-2">Amazon Affiliate Program</h3>
          <p className="mb-4">
            Boxed2Built participates in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. This means:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Some links to Amazon products on our website are affiliate links</li>
            <li>We may earn a commission if you make a qualifying purchase through these links</li>
            <li>The price you pay remains the same - there is no additional cost to you</li>
            <li>We only recommend products we have personally assembled or believe will be valuable to our customers</li>
          </ul>
          
          <h3 className="text-lg font-semibold mb-2">Third-Party Websites</h3>
          <p className="mb-4">
            Our website may contain links to third-party websites, including Amazon.com and other retailers. We are not responsible for:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>The content, products, or services offered by third-party websites</li>
            <li>The privacy practices or terms of service of third-party websites</li>
            <li>Any transactions you conduct with third-party websites</li>
            <li>The quality, safety, or legality of products purchased from third-party websites</li>
          </ul>
          <p>
            We encourage you to review the terms of service and privacy policies of any third-party websites you visit.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Service Area</h2>
        <p>
          Our furniture assembly services are available in Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas. Travel fees may apply for locations outside our primary service area.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">9. Changes to Terms</h2>
        <p>
          We may update these Terms of Service at any time. Continued use of our furniture assembly services after changes means you accept the new terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">10. Contact Boxed2Built</h2>
        <p className="mb-4">If you have questions about these Terms or our furniture assembly services in Spring Hill, TN, contact us at:</p>
        <ul className="list-none pl-0 mt-2">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-700 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+19316741196" className="text-blue-700 hover:text-blue-800 underline">(931) 674-1196</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
          <li>Services: IKEA Assembly, Target Furniture Assembly, Walmart Furniture Assembly, Professional Furniture Assembly</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          For payment processing questions or disputes, please contact Square customer support directly at 
          <a href="https://squareup.com/help" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline"> https://squareup.com/help</a>.
        </p>
      </section>
    </div>
  );
};

export default TermsOfService;