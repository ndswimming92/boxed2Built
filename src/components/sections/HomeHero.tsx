import React from 'react';
import { ArrowRight, CheckCircle, DollarSign, Phone, Calendar } from 'lucide-react';
import Button from '../ui/Button';
import OptimizedImage from '../ui/OptimizedImage';
import InternalLink from '../ui/InternalLink';
import { trackEvent, trackConversion, trackExternalLink } from '../../utils/analytics';
import { getCalendlyUrl } from '../../utils/utm';

const HomeHero: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone-click-home-hero', 'home_hero', {
      event_category: 'contact',
      value: 1,
      user_engagement: 'phone_click'
    });
    trackConversion('phone_click_hero', 1);
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-home-hero', 'home_hero', {
      event_category: 'conversion',
      value: 1,
      user_engagement: 'booking_click'
    });
    trackConversion('booking_click_hero', 1);
    window.open(getCalendlyUrl('hero'), '_blank');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-home-hero-cta', 'home_hero', {
      event_category: 'contact',
      value: 1,
      user_engagement: 'email_click'
    });
    trackConversion('email_click_hero', 1);
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Website%20Home&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Home%20Page';
  };

  const handleAmazonLinkClick = () => {
    trackEvent('amazon-affiliate-click-home-hero', 'Shine Company Vermont Porch Rocker', {
      event_category: 'affiliate',
      value: 1,
      user_engagement: 'amazon_click'
    });
    trackExternalLink('https://amzn.to/3VFC7A7', 'Amazon Product: Shine Company Vermont Porch Rocker');
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
                Spring Hill Handyman Services
                <span className="block text-blue-600">Furniture Assembly Specialists</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-6">
                Professional Spring Hill handyman services specializing in <InternalLink href="/services" trackingCategory="hero_link">furniture assembly</InternalLink>. Expert IKEA, Target & Walmart assembly in Spring Hill, Columbia & Franklin.
              </p>

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
              </div>

              <div className="flex items-center justify-center sm:justify-start mb-8">
                <a 
                  href="tel:9316741196" 
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                  onClick={handlePhoneClick}
                >
                  <Phone size={18} className="mr-2" />
                  <span className="mr-2">Call</span>
                  <span className="font-bold text-white">(931) 674-1196</span>
                  <span className="ml-2">for Service</span>
                </a>
              </div>

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
                src="/images/black-rocking-chair-front-porch-spring-hill.webp" 
                alt="Black rocking chair professionally assembled and placed on front porch in Spring Hill Tennessee - Boxed2Built" 
                className="w-full h-auto rounded object-cover"
                width="600"
                height="400"
                priority={true}
                imageType="hero"
                quality={90}
                enableAvif={true}
              />
            </div>
            
            {/* Amazon Affiliate Button */}
            <div className="text-center mt-4">
              <a
                href="https://amzn.to/3VFC7A7"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleAmazonLinkClick}
                className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 8.206 3.166 12.758 3.166 2.639 0 5.462-.394 8.29-1.275.232-.072.29-.058.29.145 0 .203-.145.348-.435.435-2.639.87-5.723 1.26-8.726 1.26-4.64 0-9.485-1.26-12.525-3.71zm-.87-2.088c-.116-.145-.029-.348.174-.29 4.262.87 8.697 1.275 12.932 1.275 3.71 0 7.826-.58 11.536-1.74.203-.058.29.029.29.203 0 .174-.116.29-.348.377-3.71 1.16-7.942 1.74-11.652 1.74-4.262 0-8.697-.406-12.932-1.565zm1.74-2.32c-.145-.174-.029-.377.203-.29 3.71.87 7.826 1.275 11.652 1.275 3.71 0 7.42-.406 10.956-1.275.203-.058.29.029.29.203 0 .174-.087.29-.29.348-3.536.87-7.246 1.275-10.956 1.275-3.826 0-7.942-.406-11.652-1.275-.232-.087-.348-.203-.203-.261z"/>
                </svg>
                Get This Rocking Chair on Amazon
              </a>
              <p className="text-xs text-gray-500 mt-2">
                As an Amazon Associate, we earn from qualifying purchases.
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
                <h2 className="font-semibold">Transparent Pricing</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Chairs</div>
                  <div className="text-xl font-bold text-blue-700">$45+</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Desks</div>
                  <div className="text-xl font-bold text-green-700">$96+</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Dressers</div>
                  <div className="text-xl font-bold text-purple-700">$166+</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Beds</div>
                  <div className="text-xl font-bold text-amber-700">$153+</div>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-500">All prices include assembly, cleanup & placement</p>
                <InternalLink href="/services" className="text-blue-700 hover:text-blue-800 text-sm font-medium" trackingCategory="pricing_link">
                  View all services →
                </InternalLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;