import React from 'react';
import { ArrowRight, CheckCircle, Phone } from 'lucide-react';
import Button from '../ui/Button';
import OptimizedImage from '../ui/OptimizedImage';
import { trackEvent, trackConversion } from '../../utils/analytics';

const HomeHero: React.FC = () => {
  const handlePhoneClick = () => {
    trackEvent('phone_click', 'hero', {
      event_category: 'contact',
      event_label: 'phone_click_hero',
      value: 1,
      user_engagement: 'phone_click',
      element_type: 'link',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'phone_click',
      conversion_type: 'phone_lead'
    });
    trackConversion('phone_click', 1, 'USD', {
      page_section: 'hero',
      conversion_type: 'phone_lead'
    });
  };

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

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-24 bg-gradient-to-br from-blue-50 via-white to-gray-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-1/4 w-96 h-96 bg-blue-100 rounded-full opacity-30 blur-3xl transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-80 h-80 bg-green-100 rounded-full opacity-30 blur-3xl transform -translate-x-1/2"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-3/5">
              <div className="animate-fadeIn">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
                  Skip The Frustration.
                  <span className="block text-blue-600 mt-2">We Build It For You.</span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed">
                  Professional furniture assembly in Spring Hill, TN. From IKEA to Walmart, we handle the hassle so you don't have to.
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                  <div className="flex items-center text-gray-700">
                    <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0" />
                    <span className="font-medium">Free Quotes</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0" />
                    <span className="font-medium">Same-Day Service Available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0" />
                    <span className="font-medium">100% Satisfaction Guaranteed</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleContactFormClick}
                    className="group text-lg px-8 py-4 shadow-xl hover:shadow-2xl"
                    trackingLabel="get_free_quote_hero"
                    pageSection="hero"
                  >
                    Get Your Free Quote
                    <ArrowRight size={24} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={18} className="text-blue-600" />
                  <span className="text-sm">Or call us at</span>
                  <a
                    href="tel:6154034538"
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                    onClick={handlePhoneClick}
                  >
                    <img
                      src="/images/contact/phone-number.svg"
                      alt="(615) 403-4538"
                      width="110"
                      height="16"
                      className="inline-block"
                    />
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:w-2/5">
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