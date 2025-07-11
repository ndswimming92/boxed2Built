import React from 'react';
import { ArrowRight, CheckCircle, DollarSign, Phone, Calendar } from 'lucide-react';
import Button from '../ui/Button';
import OptimizedImage from '../ui/OptimizedImage';
import { trackEvent } from '../../utils/analytics';
import { getCalendlyUrl } from '../../utils/utm';

const HomeHero: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone-click-home-hero');
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-home-hero');
    window.open(getCalendlyUrl('hero'), '_blank');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-home-hero-cta');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Website%20Home&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Home%20Page';
  };

  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-1/4 w-64 h-64 bg-blue-100 rounded-full opacity-50 transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-48 h-48 bg-green-100 rounded-full opacity-50 transform -translate-x-1/2"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 lg:pr-12 mb-10 lg:mb-0">
            <div className="animate-fadeIn">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                Professional Furniture Assembly
                <span className="block text-blue-600">Spring Hill, TN</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-6">
                Expert IKEA, Target & Walmart furniture assembly. Save time, avoid frustration.
              </p>

              <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Professional Service</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Free Quotes</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Local Service</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={handleBookingClick}
                  className="group"
                  trackingLabel="book-consultation-home-hero"
                >
                  Book Free Consultation
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleEmailClick}
                  className="group"
                  trackingLabel="get-quote-home-hero"
                >
                  Get Free Quote
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="flex items-center justify-center sm:justify-start mb-8">
                <a 
                  href="tel:9316741196" 
                  className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700 font-medium text-lg"
                  onClick={handlePhoneClick}
                >
                  <Phone size={20} className="mr-2" />
                  Call (931) 674-1196 for Service
                </a>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                By submitting any request, you agree to our{' '}
                <a href="/terms-of-service" className="text-blue-600 hover:text-blue-800 underline">
                  Terms of Service
                </a>
              </p>
            </div>
          </div>
          
          <div className="lg:w-1/2 relative">
            <div className="bg-white p-3 rounded-lg shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300 mb-8">
              <OptimizedImage
                src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Professional furniture assembly service in Spring Hill Tennessee" 
                className="w-full h-auto rounded"
                width="630"
                height="420"
                priority={true}
                sizes={{
                  '(max-width: 768px)': '100vw',
                  '(max-width: 1024px)': '50vw',
                  default: '40vw'
                }}
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-green-100 p-4 rounded-lg shadow-md transform -rotate-2 hover:rotate-0 transition-transform duration-300">
              <p className="text-green-800 font-medium text-sm">
                "Expert assembly, stress-free experience!"
              </p>
            </div>
          </div>
        </div>

        {/* Quick pricing preview */}
        <div className="flex justify-center mt-12">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3">
              <div className="flex items-center justify-center">
                <DollarSign size={20} className="mr-2" />
                <h3 className="font-semibold">Starting Prices</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Chairs</div>
                  <div className="text-xl font-bold text-blue-600">$41+</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Desks</div>
                  <div className="text-xl font-bold text-green-600">$87+</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Dressers</div>
                  <div className="text-xl font-bold text-purple-600">$151+</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Beds</div>
                  <div className="text-xl font-bold text-amber-600">$139+</div>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500">All prices include assembly, cleanup & placement</p>
                <a href="/services" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View all services →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;