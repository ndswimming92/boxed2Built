import React from 'react';
import { SERVICES } from '../../constants';
import { Check, ChevronDown, Phone, Mail } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';

const Services: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone-click-services');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-services');
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-services');
    window.open('https://calendly.com/boxed2built/30min', '_blank');
  };

  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="services" className="py-16 bg-white relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Our Services & Pricing
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Transparent pricing, professional service. From basic chairs to full-size wardrobes, we assemble it all—quickly and professionally.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {SERVICES.map((service) => (
            <div key={service.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-100">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{service.type}</h3>
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
                
                <h4 className="font-medium text-gray-800 mb-2">What's Included:</h4>
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
          ))}
        </div>

        {/* Enhanced CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 rounded-lg shadow-lg mb-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Book a free consultation or get a custom quote for multiple items. We offer discounts for large orders!
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
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
                href="tel:+16154034538" 
                className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
                onClick={handlePhoneClick}
              >
                <Phone size={20} className="mr-2" />
                Call Now
              </a>
              <a 
                href="mailto:boxed2builtco@gmail.com?subject=Quote%20Request&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly." 
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
                onClick={handleEmailClick}
              >
                <Mail size={20} className="mr-2" />
                Email Quote
              </a>
            </div>
          </div>
        </div>

        {/* Service Areas */}
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <h4 className="font-semibold text-gray-900 mb-2">Serving Spring Hill & Surrounding Areas</h4>
          <p className="text-gray-600">Columbia • Franklin • Thompson's Station • Brentwood</p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToAbout}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-2 py-2 shadow-md hover:shadow-lg animate-bounce"
          aria-label="Learn more about us"
        >
          <span className="text-xs font-medium mb-0.5">About Us</span>
          <ChevronDown size={16} className="text-blue-600" />
        </button>
      </div>
    </section>
  );
};

export default Services;