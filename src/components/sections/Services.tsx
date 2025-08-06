import React from 'react';
import { SERVICES } from '../../constants';
import { Check, ChevronDown, Phone, Mail, Clock } from 'lucide-react';
import Button from '../ui/Button';
import SkeletonCard from '../ui/SkeletonCard';
import { useAsyncData } from '../../hooks/useAsyncData';
import { trackEvent } from '../../utils/analytics';
import { getCalendlyUrl } from '../../utils/utm';

const Services: React.FC = () => {
  // Simulate loading state for services data
  const { data: services, loading } = useAsyncData(
    () => Promise.resolve(SERVICES),
    [],
    { delay: 300 }
  );

  const handlePhoneClick = () => {
    trackEvent('phone-click-services');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-services');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Services%20Section&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Services%20Section';
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-services');
    window.open(getCalendlyUrl('services'), '_blank');
  };

  return (
    <section id="services" className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Affordable Flat Pack Furniture Assembly Services & Pricing
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            Expert flat pack assembly for IKEA, Target, Walmart, Lowe's, Home Depot and all major furniture brands in Spring Hill, TN. 
            Affordable pricing, same day service available, professional flat pack assembly near you.
          </p>
          
          {/* Trust indicators without ratings/licensing */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-6 text-sm">
            <div className="flex items-center text-gray-700">
              <Clock size={16} className="text-blue-600 mr-2" />
              <span className="font-medium">Flexible Scheduling</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Check size={16} className="text-green-600 mr-2" />
              <span className="font-medium">Professional Service</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Check size={16} className="text-green-600 mr-2" />
              <span className="font-medium">Free Quotes</span>
            </div>
          </div>
        </div>

        {/* Enhanced service cards with more keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {loading ? (
            // Show skeleton cards while loading
            Array.from({ length: 5 }).map((_, index) => (
              <SkeletonCard 
                key={index} 
                showImage={false}
                lines={4}
                className="h-80"
              />
            ))
          ) : (
            services?.map((service, index) => (
            <div key={service.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-100">
              <div className="p-6">
                <div className="flex items-center mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{service.type} Assembly Spring Hill TN</h3>
                  {index === 0 && <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Most Popular</span>}
                </div>
                <p className="text-gray-600 mb-4">{service.description}</p>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <span className="block text-sm text-gray-500">Starting at</span>
                    <span className="text-2xl font-bold text-blue-600">{service.startingPrice}</span>
                  </div>
                  
                  {service.priceRange && (
                    <div className="mt-2 sm:mt-0">
                      <span className="block text-sm text-gray-500">Typical Range</span>
                      <span className="font-medium text-gray-700">{service.priceRange}</span>
                    </div>
                  )}
                </div>
                
                <h4 className="font-medium text-gray-800 mb-2">Professional Service Includes:</h4>
                <ul className="space-y-2">
                  {service.includedItems.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <Check size={18} className="text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            ))
          )}
        </div>

        {/* Enhanced CTA Section with more local keywords */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 rounded-lg shadow-lg mb-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready for Same Day Flat Pack Assembly?</h3>
            <p className="text-blue-100 text-lg max-w-3xl mx-auto">
              Serving Spring Hill, Columbia, Franklin & Maury County TN. Professional flat pack furniture assembly near you.
              Book same day service or get a custom quote for multiple items. Affordable pricing available!
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4">
            <Button
              onClick={handleBookingClick}
              variant="white"
              size="lg"
              className="font-semibold px-8 py-4"
              trackingLabel="book-consultation-services"
            >
              Book Free Consultation
            </Button>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="tel:+19316741196" 
                className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
                onClick={handlePhoneClick}
              >
                <Phone size={20} className="mr-2" />
                Call (931) 674-1196
              </a>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
              >
                <Mail size={20} className="mr-2" />
                Email Quote
              </a>
            </div>
          </div>

          {/* Terms notice */}
          <p className="text-xs text-blue-100 text-center">
            By submitting any request, you agree to our{' '}
            <a href="/terms-of-service" className="text-white hover:text-blue-200 underline">
              Terms of Service
            </a>
          </p>
        </div>

        {/* Enhanced Service Areas with more local keywords */}
        <div className="bg-gray-50 p-6 rounded-lg text-center mb-8">
          <h4 className="font-semibold text-gray-900 mb-2">Professional Flat Pack Furniture Assembly Service Areas in Tennessee</h4>
          <p className="text-gray-600 mb-2">
            <strong>Primary Service Areas:</strong> Spring Hill • Columbia • Franklin • Thompson's Station • Brentwood • Maury County TN
          </p>
          <p className="text-sm text-gray-500">
            Also serving: Nashville Metro Area • Williamson County • Same day furniture assembly Spring Hill TN available
          </p>
        </div>

        {/* FAQ Section for SEO */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">How much to assemble IKEA furniture Spring Hill TN?</h4>
              <p className="text-gray-600 text-sm">Our IKEA furniture assembly Spring Hill TN starts at $41 for chairs, $87 for desks, $151 for dressers. We specialize in all IKEA flat pack furniture assembly with same day service available.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Do you offer same day furniture assembly Spring Hill TN?</h4>
              <p className="text-gray-600 text-sm">Yes! We offer same day furniture assembly Spring Hill TN for IKEA, Target, Walmart, Lowe's and Home Depot flat pack furniture when scheduling permits.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What stores do you assemble furniture from?</h4>
              <p className="text-gray-600 text-sm">We provide furniture assembly service for Target buys, flat pack furniture setup Walmart Spring Hill, IKEA, Lowe's, Home Depot and all major retailers in Maury County TN.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Are you the best furniture assembly Spring Hill TN?</h4>
              <p className="text-gray-600 text-sm">We're the top-rated local furniture assembly service Spring Hill TN, specializing in professional flat pack assembly with affordable pricing and same day service availability.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;