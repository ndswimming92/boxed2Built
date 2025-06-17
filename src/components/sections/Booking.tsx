import React from 'react';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';

const Booking: React.FC = () => {
  const handleBookingClick = () => {
    trackEvent('calendly-booking-click');
    window.open('https://calendly.com/boxed2built/30min', '_blank');
  };

  return (
    <section id="booking" className="py-16 bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Book a free consultation to discuss your furniture assembly needs. 
              We'll provide an accurate quote and schedule your service at your convenience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Schedule Online</h3>
              <p className="text-blue-100">
                Pick a time that works for you using our easy online booking system
              </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">30-Minute Consultation</h3>
              <p className="text-blue-100">
                We'll discuss your project, provide a quote, and answer any questions
              </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Get It Done</h3>
              <p className="text-blue-100">
                We'll handle the assembly while you focus on what matters most
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
            <div className="text-gray-900 mb-6">
              <h3 className="text-2xl font-bold mb-3">Book Your Free Consultation</h3>
              <p className="text-gray-600">
                No commitment required. We'll discuss your project and provide a transparent quote.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-600 mr-3" />
                <span>Free consultation and quote</span>
              </div>
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-600 mr-3" />
                <span>Flexible scheduling options</span>
              </div>
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-600 mr-3" />
                <span>Professional service guarantee</span>
              </div>
            </div>

            <Button
              onClick={handleBookingClick}
              variant="primary"
              size="lg"
              className="w-full md:w-auto px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              trackingLabel="book-consultation"
            >
              <Calendar size={24} className="mr-3" />
              Book Your Free Consultation
            </Button>

            <p className="text-sm text-gray-500 mt-4">
              Available during the weekends • Serving Spring Hill and surrounding areas
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Booking;