import React from 'react';
import { ChevronDown, CheckCircle, DollarSign } from 'lucide-react';
import CallButton from '../ui/CallButton';
import OptimizedImage from '../ui/OptimizedImage';
import { trackEvent } from '../../utils/analytics';

const Hero: React.FC = () => {

  const handleEmailClick = () => {
    trackEvent('email-click-hero-cta');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Website%20Hero&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Hero%20Section';
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
        <div className="flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 lg:pr-12 mb-10 lg:mb-0">
            <div className="animate-fadeIn">
              {/* Enhanced H1 with more keywords */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                Professional Furniture Assembly Service
                <span className="block text-blue-700">Spring Hill, TN</span>
              </h1>
              
              {/* Enhanced subtitle with local keywords */}
              <p className="text-xl md:text-2xl text-gray-600 mb-6">
                Expert IKEA, Target & Walmart furniture assembly in Spring Hill, Columbia & Franklin.
              </p>

              {/* Enhanced trust indicators without ratings/licensing */}
              <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-700 mr-2" />
                  <span className="font-medium">Professional Service</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-700 mr-2" />
                  <span className="font-medium">Free Quotes</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-green-700 mr-2" />
                  <span className="font-medium">Local Service</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center sm:justify-start mb-8">
                <CallButton size="lg" pageSection="hero" />
              </div>

              {/* Terms notice */}
              <p className="text-xs text-gray-500 mb-6">
                By submitting any request, you agree to our{' '}
                <a href="/terms-of-service" className="text-blue-700 hover:text-blue-800 underline">
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
                className="w-full h-auto rounded object-cover"
                width="600"
                height="400"
                priority={true}
                imageType="hero"
                quality={90}
                enableAvif={true}
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-green-100 p-4 rounded-lg shadow-md transform -rotate-2 hover:rotate-0 transition-transform duration-300">
              <p className="text-green-800 font-medium text-sm">
                "Expert assembly, stress-free experience!"
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced pricing preview with updated 10% increased prices */}
        <div className="flex justify-center mt-16">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3">
              <div className="flex items-center justify-center">
                <DollarSign size={20} className="mr-2" />
                <h2 className="font-semibold">Transparent Furniture Assembly Pricing</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Dining Chairs</div>
                  <div className="text-xl font-bold text-blue-700">$85+</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Office Desks</div>
                  <div className="text-xl font-bold text-green-700">$96+</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">IKEA Dressers</div>
                  <div className="text-xl font-bold text-purple-700">$166+</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Bed Frames</div>
                  <div className="text-xl font-bold text-amber-700">$153+</div>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500">All prices include professional assembly, cleanup & placement in your home</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced scroll indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToServices}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-all duration-300 bg-white bg-opacity-95 backdrop-blur-sm rounded-full px-4 py-3 shadow-lg hover:shadow-xl animate-bounce hover:animate-none"
          aria-label="View detailed furniture assembly pricing and services"
        >
          <span className="text-sm font-medium mb-1">View All Services</span>
          <ChevronDown size={18} className="text-blue-700" />
        </button>
      </div>
    </section>
  );
};

export default Hero;