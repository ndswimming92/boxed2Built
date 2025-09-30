import React from 'react';
import { useEffect } from 'react';
import LocalBusinessSchema from '../components/seo/LocalBusinessSchema';
import NAPConsistency from '../components/seo/NAPConsistency';
import LocalSEOContent from '../components/seo/LocalSEOContent';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeCTA from '../components/sections/HomeCTA';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import { 
  BUSINESS_INFO, 
  ADDRESS_INFO, 
  SERVICE_AREAS, 
  PRIMARY_SERVICES, 
  SOCIAL_MEDIA_URLS,
  CUSTOMER_REVIEWS,
  LOCAL_SEO_CONTENT,
  SERVICE_KEYWORDS
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

  const napData = {
    businessName: BUSINESS_INFO.name,
    phone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    address: ADDRESS_INFO,
    serviceAreas: SERVICE_AREAS,
    website: BUSINESS_INFO.website
  };

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
      />
      <Header />
      <main className="pt-20">
        <HomeHero />
        <HomeServices />
        
        <Testimonials />
        
        {/* Local SEO Content */}
        <LocalSEOContent
          city="Spring Hill"
          state="TN"
          businessType="Furniture Assembly Service"
          services={SERVICE_KEYWORDS}
          serviceAreas={SERVICE_AREAS}
        />
        
        {/* Contact Form Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Request Your Spring Hill Handyman Services
                </h3>
                <p className="text-xl text-gray-600">
                  Ready to save time and avoid the frustration? Our Spring Hill handyman services specialize in furniture assembly. 
                  Fill out our quick form and we'll get back to you with details about your project.
                </p>
              </div>
              
              <ContactForm />
            </div>
          </div>
        </section>
        
        <HomeCTA />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;