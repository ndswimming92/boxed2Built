import React from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import CallButton from '../ui/CallButton';
import OptimizedImage from '../ui/OptimizedImage';
import { trackEvent, trackConversion } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

const HomeHero: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const handleContactFormClick = () => {
    trackEvent('cta_click', 'hero', {
      event_category: 'conversion',
      event_label: 'get_free_quote_hero',
      value: 1,
      user_engagement: 'scroll_to_form',
      element_type: 'button',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'scroll_to_form',
      conversion_type: 'form_intent'
    });
    trackConversion('cta_click', 1, 'USD', {
      page_section: 'hero',
      conversion_type: 'form_intent'
    });

    const formSection = document.getElementById('contact-form-section');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTextPhotoClick = () => {
    trackEvent('cta_click', 'hero', {
      event_category: 'conversion',
      event_label: 'text_photo_hero',
      value: 1,
      user_engagement: 'sms_intent',
      element_type: 'link',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'sms',
      conversion_type: 'sms_intent'
    });
    trackConversion('cta_click', 1, 'USD', {
      page_section: 'hero',
      conversion_type: 'sms_intent'
    });
  };

  if (loading) {
    return (
      <section className="relative pt-12 pb-8 md:pt-24 md:pb-16 bg-gradient-to-br from-blue-50 via-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto animate-pulse">
            <div className="h-12 md:h-16 bg-gray-200 rounded w-3/4 mb-3 md:mb-4"></div>
            <div className="h-6 md:h-8 bg-gray-200 rounded w-1/2 mb-4 md:mb-8"></div>
            <div className="h-10 md:h-12 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </section>
    );
  }

  const businessName = businessData?.info?.name || 'Boxed2Built';
  const slogan =
    businessData?.info?.slogan ||
    'We turn boxes into comfort so families can focus on what matters most';
  const locality = businessData?.address?.address_locality || 'Spring Hill';
  const region = businessData?.address?.address_region || 'TN';

  // Prefer a clean, consistent phone format for "sms:" links: +1XXXXXXXXXX
  const smsNumber = '+16154034538';

  return (
    <section className="relative pt-12 pb-8 md:pt-24 md:pb-16 bg-gradient-to-br from-blue-50 via-white to-gray-50">
      <div className="absolute inset-0 overflow-hidden hidden md:block">
        <div className="absolute right-0 top-1/4 w-96 h-96 bg-blue-100 rounded-full opacity-30 blur-3xl transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-80 h-80 bg-green-100 rounded-full opacity-30 blur-3xl transform -translate-x-1/2"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-3/5">
              <div className="animate-fadeIn">
                <h1 className="text-3xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-3 md:mb-6">
                  Furniture Assembly in Spring Hill, TN
                  <span className="block text-blue-600 mt-1 md:mt-2">
                    IKEA, Walmart & Flat-Pack Furniture Built for You
                  </span>
                </h1>

                <p className="text-base md:text-2xl text-gray-600 mb-4 md:mb-8 leading-relaxed">
                  Professional in-home furniture assembly for beds, desks, TV stands, shelving,
                  and more. Fast, reliable service for busy families in Spring Hill and surrounding
                  areas.
                </p>

                <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-2 md:gap-6 mb-4 md:mb-10">
                  <div className="flex items-center text-gray-700 text-sm md:text-base">
                    <CheckCircle className="text-green-600 mr-2 flex-shrink-0 w-4 h-4 md:w-5 md:h-5" />
                    <span className="font-medium">Free, No-Obligation Quotes</span>
                  </div>

                  <div className="flex items-center text-gray-700 text-sm md:text-base">
                    <CheckCircle className="text-green-600 mr-2 flex-shrink-0 w-4 h-4 md:w-5 md:h-5" />
                    <span className="font-medium">Locally Owned & Operated</span>
                  </div>

                  <div className="hidden md:flex items-center text-gray-700">
                    <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0" />
                    <span className="font-medium">Same-Day Furniture Assembly Available</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-2 md:mb-3">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleContactFormClick}
                    className="group text-base md:text-lg px-6 py-3 md:px-8 md:py-4 shadow-xl hover:shadow-2xl"
                    trackingLabel="get_free_quote_hero"
                    pageSection="hero"
                    aria-label="Get a free furniture assembly quote in Spring Hill TN"
                  >
                    Get a Free Quote in Spring Hill
                    <ArrowRight
                      className="ml-2 group-hover:translate-x-1 transition-transform w-5 h-5 md:w-6 md:h-6"
                    />
                  </Button>

                  <a
                    href={`sms:${smsNumber}`}
                    onClick={handleTextPhotoClick}
                    className="inline-flex items-center justify-center text-base md:text-lg px-6 py-3 md:px-8 md:py-4 rounded-lg border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition"
                    aria-label="Text a photo for a fast furniture assembly quote"
                  >
                    Text a Photo
                  </a>
                </div>

                <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-8">
                  Send photos + item links for the fastest quote.
                </p>

                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <span>Prefer a call?</span>
                  <CallButton size="md" pageSection="hero" />
                </div>

                {/* Keeping these in case you use them elsewhere in the component later */}
                <span className="sr-only">
                  {businessName} — {slogan} — Serving {locality}, {region}
                </span>
              </div>
            </div>

            <div className="hidden lg:block lg:w-2/5">
              <div className="bg-white p-4 rounded-2xl shadow-2xl">
                <OptimizedImage
                  src="/images/sauder-executive-desk-front-angle-spring-hill.webp"
                  alt="Professionally assembled executive desk in Spring Hill Tennessee by Boxed2Built furniture assembly service"
                  className="w-full h-auto rounded-lg object-cover"
                  width="600"
                  height="450"
                  priority={true}
                  imageType="hero"
                  quality={90}
                  enableAvif={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
