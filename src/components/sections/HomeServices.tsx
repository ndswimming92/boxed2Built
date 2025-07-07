import React from 'react';
import { Wrench, Clock, CheckCircle, ArrowRight } from 'lucide-react';

const HomeServices: React.FC = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Boxed2Built?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Professional furniture assembly service that saves you time and eliminates the frustration 
            of DIY furniture projects.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wrench className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Expert Assembly</h3>
            <p className="text-gray-600">
              Professional assembly for IKEA, Target, Walmart, and all major furniture brands. 
              We handle everything from simple chairs to complex bedroom sets.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-green-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Save Your Time</h3>
            <p className="text-gray-600">
              Skip the hours of frustration and confusing instructions. We'll have your furniture 
              assembled quickly and correctly while you focus on what matters most.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-purple-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Local & Reliable</h3>
            <p className="text-gray-600">
              Based in Spring Hill, TN, serving the local community with professional service, 
              transparent pricing, and satisfaction guaranteed.
            </p>
          </div>
        </div>

        <div className="text-center">
          <a 
            href="/about" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Learn more about our company
            <ArrowRight size={16} className="ml-2" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default HomeServices;