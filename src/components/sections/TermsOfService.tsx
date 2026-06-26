import { useEffect } from 'react';
import { LOCAL_SEO_CONTENT } from '../../constants/localSEO';

const TermsOfService = () => {
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.termsOfService.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.termsOfService.description);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service - Boxed2Built Furniture Assembly</h1>
      <p className="text-sm text-gray-500 mb-1">Effective Date: March 3, 2026</p>
      <p className="text-sm text-gray-500 mb-8">Last Updated: March 3, 2026</p>

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
          Payment for furniture assembly services is due upon completion unless otherwise agreed. We accept major forms of payment including credit/debit cards (processed through Stripe), cash, and other electronic payment methods for all furniture assembly projects.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Payment Processing and Stripe Services</h2>
        <div>
          <h3 className="text-lg font-semibold mb-2">Stripe Payment Processing</h3>
          <p className="mb-4">
            We use Stripe, Inc. as our payment processor for credit and debit card transactions. By making a payment through Stripe, you agree to:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>Stripe's Terms of Service and Privacy Policy</li>
            <li>Provide accurate payment and billing information</li>
            <li>Allow Stripe to process and store your payment information as needed</li>
            <li>Stripe's fraud prevention and security measures</li>
          </ul>

          <h3 className="text-lg font-semibold mb-2">Online Invoice Payment Links</h3>
          <p className="mb-4">
            We may send you a secure payment link to pay your invoice online. By accessing and using an invoice payment link, you acknowledge:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>Your invoice details (name, service description, amount owed) are visible to anyone with access to the link — keep your link private</li>
            <li>Payment is processed through Stripe's hosted checkout and is subject to Stripe's Terms of Service</li>
            <li>A Stripe checkout session ID will be retained in our records as a payment reference tied to your invoice</li>
            <li>Invoice payment links may expire; contact us if your link is no longer active</li>
          </ul>

          <h3 className="text-lg font-semibold mb-2">Payment Security and Disputes</h3>
          <p className="mb-4">
            Payment processing security and dispute resolution:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>All card payments are processed securely through Stripe's PCI DSS compliant systems</li>
            <li>We do not store complete credit card information on our systems</li>
            <li>Payment disputes should be directed to Stripe's customer support</li>
            <li>Chargebacks and refunds are subject to Stripe's policies and procedures</li>
            <li>You may be charged additional fees for disputed or failed payments</li>
          </ul>

          <h3 className="text-lg font-semibold mb-2">Refund Policy</h3>
          <p className="mb-4">
            Refunds for furniture assembly services:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>Refunds are provided at our discretion for unsatisfactory work</li>
            <li>Payment processing fees may not be refundable</li>
            <li>Refund processing times depend on Stripe's payment processing schedule</li>
            <li>Partial refunds may be issued for partially completed work</li>
          </ul>

          <p className="text-sm text-gray-600">
            For more information about Stripe's payment processing terms, please review{' '}
            <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">Stripe's Terms of Service</a> and{' '}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">Privacy Policy</a>.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Cancellations and Rescheduling</h2>
        <p>
          We request at least 24 hours' notice for cancellations of furniture assembly appointments. Late cancellations may be subject to a fee. Rescheduling is available when possible for Spring Hill area services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Liability and Furniture Assembly Warranty</h2>
        <p>
          We are not responsible for damage due to pre-existing defects in furniture or misuse of assembled products. Our liability for furniture assembly services is limited to the cost of the service provided. We guarantee professional assembly according to manufacturer specifications.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. Photo Submissions</h2>
        <p className="mb-4">
          You may optionally upload photos of your furniture when submitting a service request. By submitting photos, you agree to the following:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Photos are used solely for the purpose of quoting and preparing for your furniture assembly service</li>
          <li>Photos are stored securely in an access-controlled environment and are not publicly accessible</li>
          <li>Photos are retained for the duration of the associated service request and for up to one year thereafter</li>
          <li>You may request deletion of any photos you have submitted by contacting us</li>
          <li>You confirm that you have the right to submit any photos you provide</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Marketing Communications</h2>
        <p className="mb-4">
          We may send you communications related to our furniture assembly services. There are two types of communications:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li><strong>Transactional Communications:</strong> Appointment confirmations, service updates, quotes, and invoice notifications are sent as part of your service and are not subject to marketing opt-out preferences</li>
          <li><strong>Marketing Communications:</strong> Promotional offers and newsletters are only sent if you have explicitly opted in to receive them</li>
        </ul>
        <p className="text-sm text-gray-600">
          You may withdraw your marketing communication consent at any time by replying to any marketing email, calling us, or using the preference management link included in our communications. Withdrawing marketing consent does not affect transactional communications related to active or upcoming services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">9. Third-Party Services</h2>
        <div>
          <h3 className="text-lg font-semibold mb-2">Third-Party Websites</h3>
          <p className="mb-4">
            Our website may contain links to third-party websites. We are not responsible for:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
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
        <h2 className="text-xl font-semibold mb-2">10. Service Area</h2>
        <p>
          Our furniture assembly services are available in Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas. Travel fees may apply for locations outside our primary service area.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">11. Changes to Terms</h2>
        <p>
          We may update these Terms of Service at any time. Any changes will be posted on this page with the updated "Last Updated" date at the top of these terms. Continued use of our furniture assembly services after changes means you accept the new terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">12. Contact Boxed2Built</h2>
        <p className="mb-4">If you have questions about these Terms or our furniture assembly services in Spring Hill, TN, contact us at:</p>
        <ul className="list-none pl-0 mt-2 space-y-1">
          <li>Email: <a href="mailto:boxed2builtco@gmail.com" className="text-blue-700 hover:text-blue-800 underline">boxed2builtco@gmail.com</a></li>
          <li>Phone: <a href="tel:+16154034538" className="text-blue-700 hover:text-blue-800 underline">(615) 403-4538</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
          <li>Services: IKEA Assembly, Target Furniture Assembly, Walmart Furniture Assembly, Professional Furniture Assembly</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          For payment processing questions or disputes, please contact Stripe customer support directly at{' '}
          <a href="https://stripe.com/contact" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">stripe.com/contact</a>.
        </p>
      </section>
    </div>
  );
};

export default TermsOfService;
