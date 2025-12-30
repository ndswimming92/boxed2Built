import React, { useEffect, useState } from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { ChevronDown, ChevronUp, Phone, Calendar, Mail } from 'lucide-react';
import Button from '../components/ui/Button';
import CallButton from '../components/ui/CallButton';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { LOCAL_SEO_CONTENT, FAQ_CONTENT } from '../constants/localSEO';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => {
  const handleToggle = () => {
    onToggle();
    trackEvent('faq_item_toggle', 'faq_page', {
      event_category: 'engagement',
      event_label: `faq_${isOpen ? 'close' : 'open'}`,
      question_text: question,
      element_type: 'accordion',
      element_location: 'faq_page',
      page_section: 'faq_content',
      action_type: isOpen ? 'close' : 'open'
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg mb-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <button
        onClick={handleToggle}
        className="w-full text-left px-6 py-4 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold text-gray-900 pr-4">{question}</span>
        <span className="flex-shrink-0 text-blue-600">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-4 pt-2 text-gray-700 leading-relaxed animate-fadeIn">
          {answer}
        </div>
      )}
    </div>
  );
};

const FAQPage: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.faq.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.faq.description);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/faq');
  }, []);

  const handleBookingClick = () => {
    trackEvent('booking_click', 'faq_page_cta', {
      event_category: 'conversion',
      event_label: 'book_consultation_faq',
      value: 1,
      element_type: 'button',
      element_location: 'faq_page_cta',
      page_section: 'faq_page_cta',
      action_type: 'booking_click',
      conversion_type: 'calendly_booking'
    });
    window.open(getCalendlyUrl('faq'), '_blank');
  };

  const handleEmailClick = () => {
    trackEvent('email_click', 'faq_page_cta', {
      event_category: 'contact',
      event_label: 'email_click_faq',
      value: 1,
      element_type: 'link',
      element_location: 'faq_page_cta',
      page_section: 'faq_page_cta',
      action_type: 'email_click',
      conversion_type: 'email_lead'
    });
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Question%20-%20FAQ%20Page&body=I%20have%20a%20question%20about%20your%20furniture%20assembly%20services.%0A%0ASource:%20FAQ%20Page';
  };

  const toggleFAQItem = (category: string, index: number) => {
    const key = `${category}-${index}`;
    setOpenItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const allFAQs = FAQ_CONTENT.flatMap(category =>
    category.questions.map(q => ({
      question: q.question,
      answer: q.answer
    }))
  );

  if (loading || !businessData) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <EnhancedLocalBusinessSchema
        businessData={businessData}
        includeReviews={false}
        pageType="faq"
      />
      <FAQSchema faqs={allFAQs} />
      <Header />
      <main className="pt-20">
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'FAQ', href: '/faq', current: true }
                ]}
                className="mb-6"
              />

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Frequently Asked Questions
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Get answers to common questions about our furniture assembly services in Spring Hill, TN and surrounding areas.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              {FAQ_CONTENT.map((category, categoryIndex) => (
                <div
                  key={categoryIndex}
                  className="mb-12"
                  id={category.category === "What to Expect on Build Day" ? "build-day-process" : undefined}
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-blue-600">
                    {category.category}
                  </h2>

                  <div className="space-y-0">
                    {category.questions.map((faq, faqIndex) => (
                      <FAQItem
                        key={faqIndex}
                        question={faq.question}
                        answer={faq.answer}
                        isOpen={openItems.has(`${category.category}-${faqIndex}`)}
                        onToggle={() => toggleFAQItem(category.category, faqIndex)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Still Have Questions?</h2>
              <p className="text-xl text-blue-50 mb-8">
                We're here to help! Contact us today for personalized answers and a free consultation.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Button
                  onClick={handleBookingClick}
                  variant="white"
                  size="lg"
                  trackingLabel="book-consultation-faq-cta"
                >
                  <Calendar size={20} className="mr-2" />
                  Book Free Consultation
                </Button>
                <CallButton size="lg" pageSection="faq_page_cta" />
              </div>

              <button
                onClick={handleEmailClick}
                className="inline-flex items-center text-blue-100 hover:text-white transition-colors duration-200 text-lg font-medium"
              >
                <Mail size={20} className="mr-2" />
                Email us at boxed2builtco@gmail.com
              </button>

              <p className="text-xs text-blue-100 font-medium mt-6">
                By contacting us, you agree to our Terms of Service
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  Ready to Schedule Your Furniture Assembly?
                </h2>
                <p className="text-gray-700 text-center mb-6">
                  Whether you need IKEA assembly, Target furniture assembly, or help with any other brand,
                  we're here to make your life easier. Serving Spring Hill, Franklin, Columbia, Thompson's Station,
                  Brentwood, and the surrounding Nashville Metro Area.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Phone className="mx-auto mb-3 text-blue-600" size={32} />
                    <h3 className="font-semibold text-gray-900 mb-2">Call Us</h3>
                    <p className="text-sm text-gray-600 mb-3">Talk to us directly</p>
                    <CallButton size="md" pageSection="faq_page_bottom" fullWidth={true} />
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Calendar className="mx-auto mb-3 text-green-600" size={32} />
                    <h3 className="font-semibold text-gray-900 mb-2">Book Online</h3>
                    <p className="text-sm text-gray-600 mb-3">Schedule at your convenience</p>
                    <Button
                      onClick={handleBookingClick}
                      variant="primary"
                      size="md"
                      trackingLabel="book-online-faq-bottom"
                      className="w-full"
                    >
                      Book Now
                    </Button>
                  </div>

                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <Mail className="mx-auto mb-3 text-amber-600" size={32} />
                    <h3 className="font-semibold text-gray-900 mb-2">Email Us</h3>
                    <p className="text-sm text-gray-600 mb-3">Send your questions</p>
                    <Button
                      onClick={handleEmailClick}
                      variant="secondary"
                      size="md"
                      trackingLabel="email-faq-bottom"
                      className="w-full"
                    >
                      Email Us
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">
                  Learn more about our services and pricing:
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="/services"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_services',
                      action_value: '/services'
                    })}
                  >
                    View Our Services
                  </a>
                  <span className="text-gray-400">•</span>
                  <a
                    href="/about"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_about',
                      action_value: '/about'
                    })}
                  >
                    About Us
                  </a>
                  <span className="text-gray-400">•</span>
                  <a
                    href="/contact"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_contact',
                      action_value: '/contact'
                    })}
                  >
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default FAQPage;
