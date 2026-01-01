import React, { useEffect } from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Services from '../components/sections/Services';
import CallButton from '../components/ui/CallButton';
import Testimonials from '../components/sections/Testimonials';
import { trackEvent } from '../utils/analytics';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const ServicesPage: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.services.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.services.description);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/services');
  }, []);

  const servicesFAQs = [
    {
      question: "What furniture brands do you assemble?",
      answer: "We assemble furniture from all major brands including IKEA, Target, Walmart, Wayfair, Amazon, Ashley Furniture, and more. If it comes in a box, we can build it!"
    },
    {
      question: "How long does furniture assembly take?",
      answer: "Assembly time varies by item complexity. Small items like chairs take 30-60 minutes, while larger items like bed frames or dressers can take 2-3 hours. We provide time estimates with every quote."
    },
    {
      question: "Do you provide the tools for assembly?",
      answer: "Yes! We bring all professional tools and equipment needed for assembly. You don't need to provide anything - we handle everything from start to finish."
    },
    {
      question: "What's included in the assembly price?",
      answer: "Our prices include complete assembly, hardware installation, placement in your desired location, debris cleanup, and quality inspection. No hidden fees!"
    }
  ];



  const handleEmailClick = () => {
    trackEvent('email_click', 'services_page_header', {
      event_category: 'contact',
      event_label: 'email_click_services',
      value: 1,
      element_type: 'link',
      element_location: 'services_page_header',
      page_section: 'services_page_header',
      action_type: 'email_click',
      conversion_type: 'email_lead'
    });
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Services%20Page&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Services%20Page';
  };

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
        pageType="services"
      />
      <FAQSchema faqs={servicesFAQs} />
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs 
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Services', href: '/services', current: true }
                ]}
                className="mb-6"
              />
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Professional Furniture Assembly Services
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Transparent pricing, professional service, satisfaction guaranteed.
              </p>
              <p className="text-gray-700 mb-6 font-medium text-lg">
                Professional furniture assembly you can trust.
              </p>
              
              <div className="flex justify-center">
                <CallButton size="lg" pageSection="services_page_header" className="px-8 py-4" />
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <Services />

        <Testimonials />

        {/* Additional Service Information */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
                Why Choose Boxed2Built for Furniture Assembly?
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Expert Assembly Service</h3>
                  <p className="text-gray-700 mb-4">
                    Our experienced team specializes in furniture assembly for all major brands including IKEA, Target,
                    Walmart, and more. We handle everything from simple chairs to complex bedroom sets. Curious about
                    our process?{' '}
                    <a href="/faq#build-day-process" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      See what to expect on assembly day
                    </a>.{' '}
                    Read more{' '}
                    <a href="/about" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      about our expertise
                    </a>{' '}
                    and commitment to quality.
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Professional tools and equipment</li>
                    <li>• Years of assembly experience</li>
                    <li>• Attention to detail and quality</li>
                    <li>• Clean and efficient service</li>
                  </ul>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Spring Hill Service</h3>
                  <p className="text-gray-700 mb-4">
                    Based in Spring Hill, TN, we proudly serve the local community and surrounding areas. 
                    We understand the needs of Tennessee families and provide reliable, professional service. Learn more{' '}
                    <a href="/about" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      about our local commitment
                    </a>{' '}
                    and family-focused approach.
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Spring Hill, Columbia, Franklin</li>
                    <li>• Thompson's Station, Brentwood</li>
                    <li>• Flexible scheduling options</li>
                    <li>• Local community focused</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-600 text-white p-8 rounded-lg text-center">
                <h3 className="text-xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="text-blue-50 mb-6">
                  Contact us today for a free consultation and quote for your furniture assembly project.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <CallButton size="lg" pageSection="services_page_cta" />
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

export default ServicesPage;