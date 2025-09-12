import React, { useState } from 'react';
import { Phone, Clock, CheckCircle, Mail } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';

const Booking: React.FC = () => {

  const handleBookingClick = () => {
    trackEvent('contact-click-booking');
    window.location.href = '/contact';
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-booking');
  };

  return (
    <section id="booking" className="py-16 bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Contact Your Local Furniture Assembly Service Near Me
            </h2>
            <p className="text-xl text-blue-50 max-w-3xl mx-auto">
              Looking for furniture assembly near me? Ready for expert local IKEA, Target, or Walmart furniture assembly in Spring Hill, TN? 
              Contact us to discuss your project and get an accurate quote.
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
                <Phone className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Contact Options</h3>
              <p className="text-blue-50">
                Call us directly or use our contact form for furniture assembly quotes and scheduling
              </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-white" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Free Quote Discussion</h3>
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
              <h3 className="text-2xl font-bold mb-3">Get Your Free Furniture Assembly Quote</h3>
              <p className="text-gray-700">
                Contact us to discuss your IKEA, Target, or Walmart furniture assembly needs 
                and provide a transparent, upfront quote for Spring Hill area service.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center text-gray-700">
                <CheckCircle size={20} className="text-green-700 mr-3" />
                <span>Free detailed quote</span>
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Button
                onClick={handleBookingClick}
                variant="primary"
                size="lg"
                className="px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                trackingLabel="contact-us-booking"
              >
                <Mail size={24} className="mr-3" />
                Get a Free Quote
              </Button>

              <a
                href="tel:+19316741196"
                onClick={handlePhoneClick}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <Phone size={24} className="mr-3" />
                <span className="mr-2">Call</span>
                <img 
                  src="/images/contact/phone-number.svg" 
                  alt="(931) 674-1196" 
                  width="120" 
                  height="18"
                  className="inline-block"
                />
              </a>
            </div>

            <p className="text-xs text-gray-600 mt-4">
              Available weekends • 
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