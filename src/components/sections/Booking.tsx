import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, Phone } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';
import { getCalendlyUrl } from '../../utils/utm';

const Booking: React.FC = () => {
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleBookingClick = () => {
    if (!acceptTerms) {
      alert('Please accept the Terms of Service to continue.');
      return;
    }
    trackEvent('booking_click', 'booking_section', {
      event_category: 'conversion',
      event_label: 'book_consultation_booking_section',
      value: 1,
      element_type: 'button',
      element_location: 'booking_section',
      page_section: 'booking_section',
      action_type: 'booking_click',
      conversion_type: 'calendly_booking'
    });
    window.open(getCalendlyUrl('booking'), '_blank');
  };

  const handleTermsClick = () => {
    trackEvent('link_click', 'booking_section', {
      event_category: 'navigation',
      event_label: 'terms_link_booking_section',
      element_type: 'link',
      element_location: 'booking_section',
      page_section: 'booking_section',
      action_type: 'click',
      action_value: '/terms-of-service'
    });
  };

  const handlePhoneClick = () => {
    trackEvent('phone_click', 'booking_section', {
      event_category: 'contact',
      event_label: 'phone_click_booking_section',
      value: 1,
      element_type: 'link',
      element_location: 'booking_section',
      page_section: 'booking_section',
      action_type: 'phone_click',
      conversion_type: 'phone_lead'
    });
  };

  return (
    <section id="booking" className="py-16 bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Book Your Local Furniture Assembly Service Near Me
            </h2>
            <p className="text-xl text-blue-50 max-w-3xl mx-auto">
              Looking for furniture assembly near me? Ready for expert local IKEA, Target, or Walmart furniture assembly in Spring Hill, TN? 
              Book a free consultation to discuss your project and get an accurate quote.
            </p>
            
            {/* Trust indicators without ratings/licensing */}
            <div className="flex flex-wrap justify-center items-center gap-6 mt-6 text-sm">
              <div className="flex items-center text-blue-100">
                <CheckCircle size={16} className="mr-2" />
                <span>Professional Service</span>
              </div>
              <div className="flex items-center text-blue-50">
                <CheckCircle size={16} className="mr-2" />
                <span>Free Quotes</span>
              </div>
              <div className="flex items-center text-blue-50">
                <CheckCircle size={16} className="mr-2" />
                <span>Flexible Scheduling</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Online Scheduling</h3>
              <p className="text-blue-50">
                Pick a convenient time using our simple online booking system for furniture assembly
              </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Free 5-Minute Consultation</h3>
              <p className="text-blue-50">
                We'll discuss your furniture assembly project, provide a transparent quote, and answer questions
              </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional Assembly</h3>
              <p className="text-blue-50">
                Expert assembly service while you focus on what matters most to your family
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
            <div className="text-gray-900 mb-6">
              <h3 className="text-2xl font-bold mb-3">Book Your Free Furniture Assembly Consultation</h3>
              <p className="text-gray-700">
                No commitment required. We'll discuss your IKEA, Target, or Walmart furniture assembly needs 
                and provide a transparent, upfront quote for Spring Hill area service.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-700 mr-3" />
                <span>Free consultation and detailed quote</span>
              </div>
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-700 mr-3" />
                <span>Flexible scheduling including weekends</span>
              </div>
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-700 mr-3" />
                <span>Professional service guarantee</span>
              </div>
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-700 mr-3" />
                <span>Serving Spring Hill and surrounding areas</span>
              </div>
            </div>

            {/* Terms acceptance checkbox - Centered */}
            <div className="mb-6 flex justify-center">
              <label className="flex items-start text-left">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  I accept the{' '}
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                   className="text-blue-700 hover:text-blue-800 underline"
                    onClick={handleTermsClick}
                  >
                    Terms of Service
                  </a>
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Button
                onClick={handleBookingClick}
                variant="primary"
                size="lg"
                className={`px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 ${
                  !acceptTerms ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={!acceptTerms}
                trackingLabel="book_consultation_booking_section"
                pageSection="booking_section"
              >
                <Calendar size={24} className="mr-3" />
                Book Free Consultation
              </Button>

              <a
                href="tel:+16154034538"
                onClick={handlePhoneClick}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <Phone size={24} className="mr-3" />
                <span className="mr-2">Call</span>
                <img 
                  src="/images/contact/phone-number.svg" 
                  alt="(615) 403-4538" 
                  width="120" 
                  height="18"
                  className="inline-block"
                />
              </a>
            </div>

            <p className="text-xs text-gray-600 mt-4">
              By submitting, you agree to our Terms of Service • Weekend service available • 
              Serving Spring Hill, Columbia, Franklin & surrounding Tennessee areas • 
              Professional Furniture Assembly Service
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Booking;