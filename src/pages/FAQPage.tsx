import React, { useState } from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { ArrowRight, Phone, Mail } from 'lucide-react';
import Button from '../components/ui/Button';
import CallButton from '../components/ui/CallButton';
import { trackEvent } from '../utils/analytics';
import { useLoaderData } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { CompleteBusinessData } from '../lib/supabase';
import { LOCAL_SEO_CONTENT, getFaqContentWithPhone } from '../constants/localSEO';
import { formatPhoneForDisplay, formatPhoneForSchema } from '../utils/phoneFormatting';

const FAQPage: React.FC = () => {
  const { businessData } = useLoaderData() as { businessData: CompleteBusinessData };

  const phone = formatPhoneForSchema(businessData?.info?.phone);
  const phoneDisplay = formatPhoneForDisplay(phone);
  const faqContent = getFaqContentWithPhone({ phone, phoneDisplay });
  const [openItem, setOpenItem] = useState<string | null>(null);


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
    setOpenItem(prev => prev === key ? null : key);
  };

  const allFAQs = faqContent.flatMap(category =>
    category.questions.map(q => ({
      question: q.question,
      answer: q.answer
    }))
  );

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.faq.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.faq.description} />
        <link rel="canonical" href="https://boxed2built.com/faq" />
        <meta property="og:url" content="https://boxed2built.com/faq" />
        <meta property="og:title" content="Furniture Assembly FAQ | Boxed2Built Spring Hill, TN" />
        <meta property="og:description" content="Answers to your questions about furniture assembly pricing, scheduling, and service areas in Spring Hill, TN." />
        <meta name="twitter:title" content="Furniture Assembly FAQ | Boxed2Built" />
        <meta name="twitter:description" content="Get answers about furniture assembly pricing, scheduling, and service areas in Spring Hill, TN." />
      </Head>
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
  Furniture Assembly FAQs in Spring Hill, TN
</h1>

<p className="text-xl text-gray-600 mb-8">
  Find answers to common questions about our{' '}
  <a href="/services/furniture-assembly" className="text-blue-700 hover:text-blue-800 underline font-medium">
    professional furniture assembly
  </a>
  ,{' '}
  <a href="/services/tv-mounting" className="text-blue-700 hover:text-blue-800 underline font-medium">
    TV mounting
  </a>
  , and handyman services in Spring Hill, TN.
  Learn what to expect when hiring Boxed2Built for IKEA, Target, and Walmart furniture assembly in nearby areas like Franklin,
  Thompson's Station, and Columbia.
</p>

            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              {faqContent.map((category, categoryIndex) => (
                <div
                  key={categoryIndex}
                  className="mb-12"
                  id={category.category === "What to Expect on Build Day" ? "build-day-process" : undefined}
                >
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-blue-600">
                    {category.category}
                  </h2>

                  <div className="space-y-6">
                    {category.questions.map((faq, faqIndex) => {
                      const itemKey = `${category.category}-${faqIndex}`;
                      const isOpen = openItem === itemKey;
                      return (
                        <details
                          key={faqIndex}
                          className="bg-white rounded-lg shadow-md p-6 group"
                          open={isOpen}
                          onToggle={(e) => {
                            const target = e.currentTarget;
                            if (target.open) {
                              toggleFAQItem(category.category, faqIndex);
                              trackEvent('faq_item_toggle', 'faq_page', {
                                event_category: 'engagement',
                                event_label: 'faq_open',
                                question_text: faq.question,
                                element_type: 'accordion',
                                element_location: 'faq_page',
                                page_section: 'faq_content',
                                action_type: 'open'
                              });
                            } else if (isOpen) {
                              setOpenItem(null);
                              trackEvent('faq_item_toggle', 'faq_page', {
                                event_category: 'engagement',
                                event_label: 'faq_close',
                                question_text: faq.question,
                                element_type: 'accordion',
                                element_location: 'faq_page',
                                page_section: 'faq_content',
                                action_type: 'close'
                              });
                            }
                          }}
                        >
                          <summary className="flex items-center justify-between cursor-pointer list-none">
                            <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                          </summary>
                          <div className="mt-4 text-gray-600 leading-relaxed">
                            {faq.answer}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-8 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
                Explore Our Services
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="/services/furniture-assembly"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                  onClick={() => trackEvent('link_click', 'faq_page', { event_category: 'navigation', event_label: 'faq_to_furniture_assembly', action_value: '/services/furniture-assembly' })}
                >
                  <span className="text-blue-800 font-medium text-sm">Furniture Assembly Service</span>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="/services/tv-mounting"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                  onClick={() => trackEvent('link_click', 'faq_page', { event_category: 'navigation', event_label: 'faq_to_tv_mounting', action_value: '/services/tv-mounting' })}
                >
                  <span className="text-blue-800 font-medium text-sm">TV Mounting Service</span>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="/gallery"
                  className="group flex items-center justify-between bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-5 py-4 transition-colors"
                  onClick={() => trackEvent('link_click', 'faq_page', { event_category: 'navigation', event_label: 'faq_to_gallery', action_value: '/gallery' })}
                >
                  <span className="text-blue-800 font-medium text-sm">See Our Completed Projects</span>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
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

              <div className="flex justify-center mb-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Phone className="mx-auto mb-3 text-blue-600" size={32} />
                    <h3 className="font-semibold text-gray-900 mb-2">Call Us</h3>
                    <p className="text-sm text-gray-600 mb-3">Talk to us directly</p>
                    <CallButton size="md" pageSection="faq_page_bottom" fullWidth={true} />
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
                    href="/services/furniture-assembly"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_furniture_assembly',
                      action_value: '/services/furniture-assembly'
                    })}
                  >
                    Furniture Assembly
                  </a>
                  <span className="text-gray-400">•</span>
                  <a
                    href="/services/tv-mounting"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_tv_mounting',
                      action_value: '/services/tv-mounting'
                    })}
                  >
                    TV Mounting
                  </a>
                  <span className="text-gray-400">•</span>
                  <a
                    href="/services"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_services',
                      action_value: '/services'
                    })}
                  >
                    All Services &amp; Pricing
                  </a>
                  <span className="text-gray-400">•</span>
                  <a
                    href="/gallery"
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    onClick={() => trackEvent('link_click', 'faq_page', {
                      event_category: 'navigation',
                      event_label: 'faq_to_gallery',
                      action_value: '/gallery'
                    })}
                  >
                    View Our Work
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
