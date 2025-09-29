import React, { useEffect } from 'react';
import LocalBusinessSchema from '../components/seo/LocalBusinessSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Services from '../components/sections/Services';
import { ChevronRight, Phone, Mail, Calendar } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';
import Testimonials from '../components/sections/Testimonials';
import { 
  BUSINESS_INFO, 
  ADDRESS_INFO, 
  SERVICE_AREAS, 
  PRIMARY_SERVICES, 
  SOCIAL_MEDIA_URLS,
  CUSTOMER_REVIEWS,
  LOCAL_SEO_CONTENT
} from '../constants/localSEO';

const ServicesPage: React.FC = () => {
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.services.title;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.services.description);
    }

    // Set canonical URL for this page
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/services');
  }, []);

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-services-page');
    window.open(getCalendlyUrl('services'), '_blank');
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-services-page');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-services-page');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Services%20Page&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Services%20Page';
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
      <Breadcrumbs 
        items={[
          { label: 'Home', href: '/' },
          { label: 'Services', href: '/services', current: true }
        ]}
        className="container mx-auto px-4 pt-24 pb-4"
      />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-700 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">Services</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Professional Furniture Assembly Services
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Transparent pricing, professional service, satisfaction guaranteed.
              </p>
              <p className="text-gray-700 mb-6 font-medium text-lg">
                Professional furniture assembly you can trust.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={handleBookingClick}
                  variant="primary"
                  size="lg"
                  className="px-8 py-4"
                  trackingLabel="book-consultation-services-header"
                >
                  <Calendar size={20} className="mr-2" />
                  Book Free Consultation
                </Button>
                
                <a
                  href="tel:+19316741196"
                  onClick={handlePhoneClick}
                  className="inline-flex items-center justify-center px-8 py-4 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                >
                  <Phone size={20} className="mr-2" />
                  <span className="mr-2">Call</span>
                  <img 
                    src="/images/contact/phone-number.svg" 
                    alt="(931) 674-1196" 
                    width="120" 
                    height="18"
                    className="inline-block"
                  />
                </a>
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
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Why Choose Boxed2Built for Furniture Assembly?
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Expert Assembly Service</h3>
                  <p className="text-gray-700 mb-4">
                    Our experienced team specializes in furniture assembly for all major brands including IKEA, Target, 
                    Walmart, and more. We handle everything from simple chairs to complex bedroom sets. Read more{' '}
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Local Spring Hill Service</h3>
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
                <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="text-blue-50 mb-6">
                  Contact us today for a free consultation and quote for your furniture assembly project.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="tel:+19316741196"
                    onClick={handlePhoneClick}
                    className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                  >
                    <Phone size={20} className="mr-2" />
                    <span className="mr-2">Call</span>
                    <img 
                      src="/images/contact/phone-number.svg" 
                      alt="(931) 674-1196" 
                      width="120" 
                      height="18"
                      className="inline-block"
                    />
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

export default ServicesPage;