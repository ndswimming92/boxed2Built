import React from 'react';
import { Check, Phone, Mail, Clock, Sparkles } from 'lucide-react';
import SkeletonCard from '../ui/SkeletonCard';
import InternalLink from '../ui/InternalLink';
import { trackEvent } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../../services/communicationService';

const CARD_ACCENTS = [
  { border: 'border-t-blue-600', bg: 'bg-gradient-to-br from-blue-50 to-white', includedBg: 'bg-blue-50/80', includedBorder: 'border-blue-200', check: 'text-blue-600', priceBg: 'bg-blue-600' },
  { border: 'border-t-teal-500', bg: 'bg-gradient-to-br from-teal-50 to-white', includedBg: 'bg-teal-50/80', includedBorder: 'border-teal-200', check: 'text-teal-600', priceBg: 'bg-teal-600' },
  { border: 'border-t-emerald-500', bg: 'bg-gradient-to-br from-emerald-50 to-white', includedBg: 'bg-emerald-50/80', includedBorder: 'border-emerald-200', check: 'text-emerald-600', priceBg: 'bg-emerald-600' },
  { border: 'border-t-amber-500', bg: 'bg-gradient-to-br from-amber-50 to-white', includedBg: 'bg-amber-50/80', includedBorder: 'border-amber-200', check: 'text-amber-600', priceBg: 'bg-amber-600' },
  { border: 'border-t-sky-500', bg: 'bg-gradient-to-br from-sky-50 to-white', includedBg: 'bg-sky-50/80', includedBorder: 'border-sky-200', check: 'text-sky-600', priceBg: 'bg-sky-600' },
];

const Services: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const phoneRaw = businessData?.info?.phone || '+16154034538';
  const phoneDisplay = formatPhoneForDisplay(phoneRaw.replace(/^\+1/, ''));

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
    window.location.href = 'mailto:nicholas.davidson@boxed2built.com?subject=Quote%20Request%20-%20Services%20Section&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Website%20Services%20Section';
  };


  return (
    <section id="services" className="py-12 bg-gradient-to-b from-gray-50 to-white">
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
            services?.map((service, index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
              const isPopular = service.id === '3';
              return (
                <div
                  key={service.id}
                  className={`relative rounded-xl border-t-4 ${accent.border} ${accent.bg} shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden ${isPopular ? 'ring-2 ring-emerald-400/50' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        <Sparkles size={12} />
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{service.type}</h3>
                    <p className="text-gray-600 mb-5 leading-relaxed">{service.description}</p>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-5 pb-5 border-b border-gray-200/80">
                      <div>
                        <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Starting at</span>
                        <span className={`inline-block text-2xl font-extrabold text-white ${accent.priceBg} px-3 py-1 rounded-lg`}>
                          {service.startingPrice}
                        </span>
                      </div>

                      {(service.minPrice !== null || service.maxPrice !== null) && (
                        <div className="mt-3 sm:mt-0 text-right">
                          <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Typical Range</span>
                          <span className="inline-block font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg text-sm">
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
                      <div className={`rounded-lg p-4 ${accent.includedBg} border ${accent.includedBorder}`}>
                        <p className="text-sm font-bold text-gray-900 mb-3">What's Included:</p>
                        <ul className="text-sm text-gray-700 space-y-2">
                          {service.includedItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <Check size={15} className={`${accent.check} mt-0.5 shrink-0`} strokeWidth={3} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="mt-4 text-xs text-gray-400 italic">
                      Labor-only service. Not subject to Tennessee sales tax (SUT-115).
                    </p>
                  </div>
                </div>
              );
            })
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
              href={`tel:${phoneRaw}`}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
              onClick={handlePhoneClick}
            >
              <Phone size={20} className="mr-2" />
              Call {phoneDisplay}
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
              <p className="text-gray-600 text-sm">You can schedule furniture assembly by calling us at {phoneDisplay} or booking online through our website. We offer flexible scheduling to fit your needs.</p>
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
