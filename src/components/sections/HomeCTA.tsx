import React from 'react';
import { CheckCircle } from 'lucide-react';
import CallButton from '../ui/CallButton';

const HomeCTA: React.FC = () => {
  return (
    <section className="py-16 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <img
          src="/images/marketing-images/Boxed2Built_Skip_The_Build_Enjoy_Moments.png"
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          aria-hidden="true"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready for Local Furniture Assembly Near Me?
          </h2>
          <p className="text-xl text-blue-50 mb-8">
            Book a free consultation with your local furniture assembly service to discuss your project and get an accurate quote.
            Serving Spring Hill, TN and surrounding areas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <CheckCircle className="text-white mx-auto mb-2" size={24} />
              <h4 className="font-semibold mb-1">Free Quotes</h4>
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
                Call us for a free quote on your furniture assembly project.
              </p>
            </div>

            <div className="flex flex-col gap-3">
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