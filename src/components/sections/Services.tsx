import React from 'react';
import { SERVICES } from '../../constants';
import { Check, ChevronDown } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

const Services: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone-click-services');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-services');
  };

  const scrollToBooking = () => {
    const bookingSection = document.getElementById('booking');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="services" className="py-16 bg-gray-50 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Our Services & Pricing
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            From basic chairs to full-size wardrobes, we assemble it all—quickly and professionally. Explore our services below to see what we offer and how much it typically costs.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {SERVICES.map((service) => (
            <div key={service.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{service.type}</h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 pb-4 border-b border-gray-100">
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

        <div className="mt-12 bg-blue-600 text-white p-8 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0 md:mr-8">
              <h3 className="text-2xl font-bold mb-2">Need a Custom Quote?</h3>
              <p className="opacity-90">
                For multiple items or custom projects, contact us for a personalized quote.
                We offer discounts for large orders!
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="tel:+16154034538" 
                className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
                onClick={handlePhoneClick}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us
              </a>
              <a 
                href="mailto:boxed2builtco@gmail.com?subject=Quote%20Request&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly." 
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
                onClick={handleEmailClick}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce">
        <button
          onClick={scrollToBooking}
          className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors"
          aria-label="Book your service"
        >
          <span className="text-sm font-medium mb-1">Book Now</span>
          <ChevronDown size={24} />
        </button>
      </div>
    </section>
  );
};

export default Services;