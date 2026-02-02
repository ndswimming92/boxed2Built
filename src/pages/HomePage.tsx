import React from 'react';
import { useEffect } from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import FAQSchema from '../components/seo/FAQSchema';
import ServiceAreaSchema from '../components/seo/ServiceAreaSchema';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeFAQ from '../components/sections/HomeFAQ';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import Pricing from '../components/sections/Pricing';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import {
  LOCAL_SEO_CONTENT,
  FAQ_CONTENT
} from '../constants/localSEO';

const HomePage: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.homepage.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.homepage.description);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/');
  }, []);

  // Get high-value FAQ questions from Common Questions category plus a few popular ones
  const commonQuestions = FAQ_CONTENT.find(cat => cat.category === "Common Questions")?.questions || [];
  const generalQuestions = FAQ_CONTENT.find(cat => cat.category === "General Information")?.questions || [];

  const homepageFAQs = [
    ...commonQuestions, // All 4 high-value SEO questions
    generalQuestions[0], // What is Boxed2Built?
    {
      question: "How much does furniture assembly cost in Spring Hill, TN?",
      answer: "Our furniture assembly prices start at $85 for small items like chairs, $185 for tables and desks, $220 for storage and shelving, $320 for dressers, and $295 for bed frames. All prices include assembly, cleanup, and placement."
    }
  ];

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
        includeReviews={true}
        pageType="home"
      />
      <FAQSchema faqs={homepageFAQs} />
      <ServiceAreaSchema
        businessName={businessData.info.name}
        businessUrl={businessData.info.website}
        serviceAreas={businessData.serviceAreas}
      />
      <Header />
      <main className="pt-16">
        <HomeHero />

        <section id="contact-form-section" className="py-12 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Get Your Free Quote Today
                </h2>
                <p className="text-xl text-gray-600">
                  Tell us about your furniture assembly needs and we'll respond within 24 hours with a personalized quote. No obligation, completely free.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-gray-200">
                <ContactForm />
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                <span className="inline-block mr-2">✓</span> Average response time: 2-4 hours
                <span className="inline-block mx-4">•</span>
                <span className="inline-block mr-2">✓</span> Serving Spring Hill, Columbia, Franklin & surrounding areas
              </p>

              <div className="text-center mt-6">
                <a href="/faq#build-day-process" className="text-blue-700 hover:text-blue-800 underline font-medium text-base">
                  Learn about our assembly process and what to expect on build day →
                </a>
              </div>
            </div>
          </div>
        </section>

        <HomeServices />

        <Testimonials />

        <Pricing />

        <HomeFAQ
          faqs={homepageFAQs}
          title="Frequently Asked Questions"
          subtitle="Get answers to the most common questions about furniture assembly in Spring Hill, TN"
          showViewAllLink={true}
        />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;