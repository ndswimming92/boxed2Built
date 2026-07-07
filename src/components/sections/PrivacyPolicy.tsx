import { useEffect } from 'react';
import { LOCAL_SEO_CONTENT } from '../../constants/localSEO';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../../services/communicationService';

const PrivacyPolicy = () => {
  const { data: businessData } = useBusinessDataWithFallback();
  const phoneRaw = businessData?.info?.phone || "+16154034538";
  const phoneDisplay = formatPhoneForDisplay(phoneRaw.replace(/^\+1/, ""));
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.privacyPolicy.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.privacyPolicy.description);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy - Boxed2Built Furniture Assembly</h1>
      <p className="text-sm text-gray-500 mb-1">Effective Date: March 3, 2026</p>
      <p className="text-sm text-gray-500 mb-8">Last Updated: March 3, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
        <p className="mb-4">
          Boxed2Built furniture assembly service may collect the following types of personal information when you request our services in Spring Hill, TN and surrounding areas:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li><strong>Contact Information:</strong> Name, email address, phone number, service address in Spring Hill, Columbia, Franklin, or surrounding Tennessee areas.</li>
          <li><strong>Service Details:</strong> Furniture assembly requests, IKEA, Target, or Walmart furniture specifications.</li>
          <li><strong>Photos &amp; Media:</strong> Furniture photos you optionally upload with a service request. These images are stored securely and used solely for quoting and service delivery purposes.</li>
          <li><strong>Device Information:</strong> IP address, browser type, website usage data for our furniture assembly website.</li>
          <li><strong>Analytics Data:</strong> Website usage patterns, page views, session duration, and user interactions collected through Google Analytics 4.</li>
          <li><strong>Technical Data:</strong> Device type, operating system, screen resolution, and browsing behavior for website optimization purposes.</li>
          <li><strong>Marketing Attribution Data:</strong> UTM parameters (source, medium, campaign) and referral source information collected when you submit a contact form. This data is used solely to understand how customers find our business and is never sold or shared with third parties for marketing purposes.</li>
          <li><strong>Client Marketing Preferences:</strong> Your opt-in or opt-out status for marketing communications, along with your service history and contact history, used to ensure we only send communications you have consented to receive.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
        <p className="mb-4">We use your information to provide professional furniture assembly services:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Provide and schedule furniture assembly services in Spring Hill and surrounding Tennessee areas</li>
          <li>Send quotes for IKEA, Target, Walmart and other furniture assembly projects</li>
          <li>Send service updates and appointment confirmations (transactional communications)</li>
          <li>Send promotional offers for furniture assembly services (only if you have opted in to marketing communications)</li>
          <li>Review furniture photos you submit to provide accurate quotes and prepare for service</li>
          <li>Improve our furniture assembly website and service offerings using analytics data</li>
          <li>Analyze website performance and user experience through Google Analytics 4</li>
          <li>Understand how customers discover our business using marketing attribution data</li>
          <li>Understand customer preferences and optimize our online presence</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          <strong>Transactional vs. Marketing Communications:</strong> Appointment confirmations, service updates, quotes, and invoice notifications are transactional and are sent regardless of marketing preferences. Promotional offers and newsletters are marketing communications and are only sent if you have explicitly opted in.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">3. How We Share Your Information</h2>
        <p className="mb-4">We do not sell or rent your personal information. We may share it with:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Service providers assisting with our furniture assembly business operations</li>
          <li>Stripe, Inc. for payment processing when you pay for our services or pay an invoice online</li>
          <li>Google (through Google Analytics 4) for website analytics purposes</li>
                    <li>Third-party analytics providers to help us understand website usage and improve our services</li>
          <li>Law enforcement if required by Tennessee state law or federal law</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Note: Stripe and Google Analytics have their own privacy policies and data handling practices. We recommend reviewing their privacy policies for more information about how they process data:
          <br />• Stripe Privacy Policy: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">https://stripe.com/privacy</a>
          <br />• Google Analytics privacy policy is available on their website
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">4. Payment Processing</h2>
        <div>
          <h3 className="text-lg font-semibold mb-2">Stripe Payment Processing</h3>
          <p className="mb-4">
            We use Stripe, Inc. as our payment processor for furniture assembly services. When you make a payment or pay an invoice online:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>Stripe collects and processes your payment information (credit/debit card details, billing address)</li>
            <li>Stripe uses industry-standard security measures and is PCI DSS compliant</li>
            <li>Your payment information is subject to Stripe's Privacy Policy and Terms of Service</li>
            <li>We do not store your complete credit card information on our systems</li>
            <li>Stripe may use your information for fraud prevention and compliance purposes</li>
            <li>A Stripe session ID is retained in our system as a reference tied to your invoice record</li>
          </ul>

          <h3 className="text-lg font-semibold mb-2">Online Invoice Payment Links</h3>
          <p className="mb-4">
            We may send you a secure payment link associated with your invoice. When you access a payment link:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-1">
            <li>You will be able to view your invoice details including your name, service description, and the amount owed</li>
            <li>Payment is processed securely through Stripe's hosted checkout</li>
            <li>Anyone with access to the payment link can view invoice details, so please keep your link private</li>
            <li>A Stripe checkout session ID is stored in our records as a payment reference</li>
          </ul>

          <p className="text-sm text-gray-600 mb-3">
            For more information about how Stripe handles your payment data, please review{' '}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">Stripe's Privacy Policy</a> and{' '}
            <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">Terms of Service</a>.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">5. Your Rights and Choices</h2>
        <p className="mb-4">Regarding your furniture assembly service information, you may:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Request a copy of your data related to our furniture assembly services</li>
          <li>Request deletion of your personal information</li>
          <li>Opt out of promotional communications about furniture assembly services at any time by replying to any marketing email, calling us, or using the preference management link included in our communications</li>
          <li>Update or withdraw your marketing communication consent at any time</li>
          <li>Request deletion of any furniture photos you have submitted</li>
          <li>Contact Stripe directly regarding payment data through their customer support</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          To exercise any of these rights, contact us at <a href="mailto:nicholas.davidson@boxed2built.com" className="text-blue-700 hover:text-blue-800 underline">nicholas.davidson@boxed2built.com</a> or <a href={`tel:${phoneRaw}`} className="text-blue-700 hover:text-blue-800 underline">{phoneDisplay}</a>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">6. Cookies and Tracking Technologies</h2>
        <div>
          <p className="mb-4">We use cookies and similar technologies to analyze site traffic, improve performance, and enhance user experience on our furniture assembly website.</p>

          <h3 className="text-lg font-semibold mb-2">Stripe Payment Processing:</h3>
          <div className="mb-4">
            <p className="mb-2">When processing payments through Stripe:</p>
            <ul className="list-disc pl-6 mb-3 space-y-1">
              <li>Stripe may place cookies and tracking pixels for payment processing and fraud prevention</li>
              <li>Stripe may collect device and browser information during payment transactions</li>
              <li>Stripe uses this data to secure transactions and prevent fraudulent activity</li>
              <li>Payment processing data is governed by Stripe's privacy practices</li>
            </ul>
          </div>

          <h3 className="text-lg font-semibold mb-2">Analytics Services We Use:</h3>
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Google Analytics 4 (GA4)</h4>
            <p className="mb-2">We use Google Analytics 4 to understand how visitors interact with our furniture assembly website. GA4 collects:</p>
            <ul className="list-disc pl-6 mb-3 space-y-1">
              <li>Page views and session data</li>
              <li>User engagement metrics</li>
              <li>Traffic sources and referral information</li>
              <li>Device and browser information</li>
              <li>Geographic location (city/region level)</li>
            </ul>
            <p className="text-sm text-gray-600 mb-3">
              Google Analytics uses cookies to track your activity. You can opt out of Google Analytics by installing the{' '}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">Google Analytics Opt-out Browser Add-on</a>.
            </p>
          </div>

          <h3 className="text-lg font-semibold mb-2">Managing Your Preferences:</h3>
          <p className="mb-2">You can control cookies and tracking through:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your browser settings to block or delete cookies</li>
            <li>Opting out of Google Analytics using their browser add-on</li>
            <li>Using "Do Not Track" browser settings</li>
            <li>Contacting us to request data deletion</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">7. How We Protect Your Information</h2>
        <p>We use reasonable security measures such as encryption, secure forms, and restricted access to protect your furniture assembly service data. Payment processing is handled securely through Stripe's PCI DSS compliant systems. Furniture photos are stored in a secure, access-controlled storage environment and are not publicly accessible.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">8. Data Retention</h2>
        <p className="mb-4">We retain your personal information only as long as necessary to provide our services and meet our legal obligations. Our general retention periods are:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Form Inquiries:</strong> Retained for one year from the date of submission</li>
          <li><strong>Client Records:</strong> Retained for one year from your last service or interaction</li>
          <li><strong>Job Records:</strong> Retained for one year from the job completion or cancellation date</li>
          <li><strong>Invoice Records:</strong> Retained for one year from the invoice date</li>
          <li><strong>Furniture Photos:</strong> Retained for the duration of the associated service request and for up to one year thereafter</li>
          <li><strong>Payment Records:</strong> Stripe may retain payment-related data for longer periods in accordance with their own retention policies and applicable financial regulations</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          You may request early deletion of your data at any time by contacting us. See Section 5 for your rights and how to exercise them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">9. Children's Privacy</h2>
        <p>Our furniture assembly services are not directed to children under 13, and we do not knowingly collect data from minors.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with the updated "Last Updated" date at the top of this policy.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">11. Contact Boxed2Built</h2>
        <p className="mb-4">If you have questions about this privacy policy or our furniture assembly services in Spring Hill, TN, you can contact us at:</p>
        <ul className="list-none pl-0 mt-2 space-y-1">
          <li>Email: <a href="mailto:nicholas.davidson@boxed2built.com" className="text-blue-700 hover:text-blue-800 underline">nicholas.davidson@boxed2built.com</a></li>
          <li>Phone: <a href="tel:+16154034538" className="text-blue-700 hover:text-blue-800 underline">(615) 403-4538</a></li>
          <li>Service Area: Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, TN</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          For payment-related inquiries, you may also contact Stripe directly through their customer support channels at <a href="https://stripe.com/contact" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline">stripe.com/contact</a>.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
