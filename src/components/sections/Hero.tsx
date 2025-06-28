import React from 'react';
import { ArrowRight, ChevronDown, CheckCircle, DollarSign } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';

const Hero: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone-click-hero');
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-hero');
    window.open('https://calendly.com/boxed2built/30min', '_blank');
  };

  const scrollToServices = () => {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-1/4 w-64 h-64 bg-blue-100 rounded-full opacity-50 transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-48 h-48 bg-green-100 rounded-full opacity-50 transform -translate-x-1/2"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 md:pr-12 mb-10 md:mb-0">
            <div className="animate-fadeIn">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                Hassle-Free Furniture Assembly
                <span className="block text-blue-600">Done For You</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-6">
                From Boxed to Built – We handle the build, so you don't have to.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Professional Service</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Same-Day Available</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Local Spring Hill Service</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={handleBookingClick}
                  className="group"
                  trackingLabel="book-consultation-hero"
                >
                  Book Free Consultation
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <a 
                  href="tel:6154034538" 
                  className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700 font-medium text-lg px-6 py-3"
                  onClick={handlePhoneClick}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  (615) 403-4538
                </a>
              </div>

              {/* Enhanced pricing preview */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3">
                  <div className="flex items-center">
                    <DollarSign size={20} className="mr-2" />
                    <h3 className="font-semibold">Transparent Pricing</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Chairs</div>
                      <div className="text-xl font-bold text-blue-600">$37+</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Desks</div>
                      <div className="text-xl font-bold text-green-600">$79+</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Dressers</div>
                      <div className="text-xl font-bold text-purple-600">$137+</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Beds</div>
                      <div className="text-xl font-bold text-amber-600">$126+</div>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-500">All prices include assembly, cleanup & placement</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2 relative">
            <div className="bg-white p-3 rounded-lg shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <img 
                src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Professional furniture assembly service" 
                className="w-full h-auto rounded"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-green-100 p-4 rounded-lg shadow-md transform -rotate-2 hover:rotate-0 transition-transform duration-300">
              <p className="text-green-800 font-medium text-sm">
                "Built for you, stress-free!"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator - positioned to avoid overlap */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToServices}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-all duration-300 bg-white bg-opacity-95 backdrop-blur-sm rounded-full px-4 py-3 shadow-lg hover:shadow-xl animate-bounce hover:animate-none"
          aria-label="View pricing and services"
        >
          <span className="text-sm font-medium mb-1">View Pricing</span>
          <ChevronDown size={18} className="text-blue-600" />
        </button>
      </div>
    </section>
  );
};

export default Hero;