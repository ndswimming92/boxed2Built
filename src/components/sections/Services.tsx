import React from 'react';
import { Check, Phone, Mail, Clock } from 'lucide-react';
import SkeletonCard from '../ui/SkeletonCard';
import InternalLink from '../ui/InternalLink';
import { trackEvent } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

const Services: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const services = businessData?.services.map(service => {
    const startingPrice =
      typeof service.base_price === 'number' ? `$${service.base_price.toFixed(0)}` : 'Request a quote';

    return {
      id: service.id,
      type: service.name,
      description: service.description,
      startingPrice,
      minPrice: typeof service.min_price === 'number' ? service.min_price : null,
      maxPrice: typeof service.max_price === 'number' ? service.max_price : null,
      includedItems: service.included_items || []
    };
  }) || [];

  const handlePhoneClick = () => {
    trackEvent('phone-click-services');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-services');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request%20-%20Services%20Section&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Services%20Section';
  };


  return (
    <section id="services" className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Spring Hill Handyman Services - Furniture Assembly Specialists
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            Professional Spring Hill handyman services specializing in furniture assembly. Expert assembly for IKEA, Target, Walmart, and all major furniture brands. 
            Transparent pricing, professional handyman service, flexible scheduling. Learn more{' '}
            <InternalLink href="/about" trackingCategory="services_page">
              about our expertise and commitment
            </InternalLink>{' '}
            to Tennessee families.
          </p>
          
          {/* Trust indicators without ratings/licensing */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-6 text-sm">
            <div className="flex items-center text-gray-700">
              <Clock size={16} className="text-blue-700 mr-2" />
              <span className="font-medium">Flexible Scheduling</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Check size={16} className="text-green-700 mr-2" />
              <span className="font-medium">Professional Service</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Check size={16} className="text-green-700 mr-2" />
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
                  <h3 className="text-lg font-bold text-gray-900">{service.type}</h3>
                  {service.id === 3 && <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Most Popular</span>}
                </div>
                <p className="text-gray-600 mb-4">{service.description}</p>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <span className="block text-sm text-gray-500">Starting at</span>
                    <span className="text-2xl font-bold text-blue-700">{service.startingPrice}</span>
                  </div>

                  {(service.minPrice !== null || service.maxPrice !== null) && (
                    <div className="mt-2 sm:mt-0">
                      <span className="block text-sm text-gray-500">Typical Range</span>
                      <span className="font-medium text-gray-700">
                        {service.minPrice !== null && service.maxPrice !== null
                          ? `$${service.minPrice.toFixed(0)} - $${service.maxPrice.toFixed(0)}`
                          : service.minPrice !== null
                          ? `From $${service.minPrice.toFixed(0)}`
                          : `Up to $${service.maxPrice!.toFixed(0)}`}
                      </span>
                    </div>
                  )}
                </div>

                {service.includedItems && service.includedItems.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 mb-2">What's Included:</p>
                    <ul className="text-sm text-gray-700 space-y-1.5">
                      {service.includedItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Labor-only service. Not subject to Tennessee sales tax (SUT-115).
                  </p>
                </div>
              </div>
            </div>
            ))
          )}
        </div>

        {/* Enhanced CTA Section with more local keywords */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 rounded-lg shadow-lg mb-8">
          <div className="text-center mb-8">
              <InternalLink href="/about" trackingCategory="services_info">
            <p className="text-blue-50 text-lg max-w-3xl mx-auto">
              Book a free consultation or get a custom quote for multiple items. Volume discounts available!
            </p>
              </InternalLink>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4">
            <a
              href="tel:+16155511402"
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
              onClick={handlePhoneClick}
            >
              <Phone size={20} className="mr-2" />
              Call (615) 551-1402
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
              className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
            >
              <Mail size={20} className="mr-2" />
              Email Quote
            </a>
          </div>

          {/* Terms notice */}
          <p className="text-xs text-blue-50 text-center">
            By submitting any request, you agree to our{' '}
            <a href="/terms-of-service" className="text-blue-50 hover:text-white underline">
              Terms of Service
            </a>
          </p>
        </div>

        {/* Enhanced Service Areas with more local keywords */}
        <div className="bg-gray-50 p-6 rounded-lg text-center mb-8">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Professional Furniture Assembly Service Areas in Tennessee</h3>
          <p className="text-gray-600 mb-2">
            <strong>Primary Service Areas:</strong> Spring Hill • Columbia • Franklin • Thompson's Station • Brentwood
          </p>
          <p className="text-sm text-gray-500">
            Also serving: Nashville Metro Area • Williamson County • Maury County • Flexible scheduling available
          </p>
        </div>

        {/* FAQ Section for SEO */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Do you assemble IKEA furniture?</h4>
              <p className="text-gray-600 text-sm">Yes, we specialize in IKEA furniture assembly and are experienced with all IKEA product lines including beds, dressers, desks, and storage solutions.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">What's included in the assembly service?</h4>
              <p className="text-gray-600 text-sm">All services include unboxing, complete assembly, placement in your desired location, debris cleanup, and a final quality check.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">How do I schedule service?</h4>
              <p className="text-gray-600 text-sm">You can schedule furniture assembly by calling us at (615) 403-4538 or booking online through our website. We offer flexible scheduling to fit your needs.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Do you offer volume discounts?</h4>
              <p className="text-gray-600 text-sm">Yes, we offer volume discounts for multiple furniture items. Contact us for a custom quote on larger projects.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
