import React from 'react';
import { useEffect } from 'react';
import LocalBusinessSchema from '../components/seo/LocalBusinessSchema';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import Pricing from '../components/sections/Pricing';
import {
  BUSINESS_INFO,
  ADDRESS_INFO,
  SERVICE_AREAS,
  PRIMARY_SERVICES,
  SOCIAL_MEDIA_URLS,
  CUSTOMER_REVIEWS,
  LOCAL_SEO_CONTENT
} from '../constants/localSEO';

const HomePage: React.FC = () => {
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.homepage.title;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.homepage.description);
    }

    // Set canonical URL for home page (should remain as root)
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/');
  }, []);


  return (
    <>
      <LocalBusinessSchema
        phone={BUSINESS_INFO.phone}
        email={BUSINESS_INFO.email}
        website={BUSINESS_INFO.website}
        serviceAreas={SERVICE_AREAS}
        services={PRIMARY_SERVICES}
        socialMediaUrls={SOCIAL_MEDIA_URLS}
        reviews={CUSTOMER_REVIEWS}
        includeReviews={true}
      />
      <Header />
      <main className="pt-20">
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
            </div>
          </div>
        </section>

        <HomeServices />

        <Testimonials />

        <Pricing />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;