import React, { useState } from 'react';
import { Calendar, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import CallButton from '../ui/CallButton';
import { trackEvent } from '../../utils/analytics';
import { getCalendlyUrl } from '../../utils/utm';

const HomeCTA: React.FC = () => {
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleBookingClick = () => {
    if (!acceptTerms) {
      alert('Please accept the Terms of Service to continue.');
      return;
    }
    trackEvent('booking_click', 'cta', {
      event_category: 'conversion',
      event_label: 'book_consultation_cta',
      value: 1,
      element_type: 'button',
      element_location: 'cta',
      page_section: 'cta',
      action_type: 'booking_click',
      conversion_type: 'calendly_booking'
    });
    window.open(getCalendlyUrl('booking'), '_blank');
  };

  const handleTermsClick = () => {
    trackEvent('link_click', 'cta', {
      event_category: 'navigation',
      event_label: 'terms_link_cta',
      element_type: 'link',
      element_location: 'cta',
      page_section: 'cta',
      action_type: 'click',
      action_value: '/terms-of-service'
    });
  };


  return (
    <section className="py-12 bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready for Local Furniture Assembly Near Me?
          </h2>
          <p className="text-xl text-blue-50 mb-8">
            Book a free consultation with your local furniture assembly service to discuss your project and get an accurate quote. 
            Serving Spring Hill, TN and surrounding areas.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <Calendar className="text-white mx-auto mb-2" size={24} />
              <h4 className="font-semibold mb-1">Easy Scheduling</h4>
              <p className="text-blue-50 text-sm font-medium">Book online or call</p>
            </div>
            
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <CheckCircle className="text-white mx-auto mb-2" size={24} />
              <h4 className="font-semibold mb-1">Free Consultation</h4>
              <p className="text-blue-50 text-sm font-medium">No commitment required</p>
            </div>
            
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <CheckCircle className="text-white mx-auto mb-2" size={24} />
              <h4 className="font-semibold mb-1">Professional Service</h4>
              <p className="text-blue-50 text-sm font-medium">Quality guaranteed</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-auto">
            <div className="text-gray-900 mb-4">
              <h4 className="text-lg font-bold mb-2">Get Started Today</h4>
              <p className="text-gray-700 text-sm">
                Free consultation and transparent quote for your furniture assembly project.
              </p>
            </div>

            {/* Terms acceptance checkbox */}
            <div className="mb-4 flex justify-center">
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

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleBookingClick}
                variant="primary"
                size="lg"
                className={`w-full ${!acceptTerms ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!acceptTerms}
                trackingLabel="book_consultation_cta"
                pageSection="cta"
              >
                <Calendar size={20} className="mr-2" />
                Book Free Consultation
              </Button>

              <CallButton size="lg" pageSection="cta" fullWidth={true} />
            </div>

            <p className="text-xs text-gray-600 mt-3 text-center">
              Weekend furniture assembly service • Serving Spring Hill, Columbia, Franklin & surrounding Tennessee areas
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeCTA;