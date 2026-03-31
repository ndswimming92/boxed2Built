import React from 'react';
import { Wrench, Clock, CheckCircle } from 'lucide-react';
import InternalLink from '../ui/InternalLink';

const HomeServices: React.FC = () => {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Why Choose Boxed2Built?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Professional furniture assembly service that saves you time and eliminates the frustration 
            of DIY furniture projects.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wrench className="text-blue-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Expert Assembly</h3>
            <p className="text-gray-700">
              Professional assembly for IKEA, Target, Walmart, and all major furniture brands.
              We handle everything from simple chairs to complex bedroom sets. Learn more about our{' '}
              <InternalLink href="/services/furniture-assembly" trackingCategory="services_section">
                furniture assembly service
              </InternalLink>{' '}
              or{' '}
              <InternalLink href="/services/tv-mounting" trackingCategory="services_section">
                TV mounting
              </InternalLink>.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-green-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Save Your Time</h3>
            <p className="text-gray-700">
              Skip the hours of frustration and confusing instructions. We'll have your furniture
              assembled quickly and correctly while you focus on what matters most. See our{' '}
              <InternalLink href="/services" trackingCategory="services_section">
                transparent pricing
              </InternalLink>{' '}
              for all service types.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Local & Reliable</h3>
            <p className="text-gray-700">
              Based in Spring Hill, TN, serving the local community with professional service,
              transparent pricing, and satisfaction guaranteed. Learn more{' '}
              <InternalLink href="/about" trackingCategory="services_section">
                about our commitment
              </InternalLink>{' '}
              to Tennessee families, or{' '}
              <InternalLink href="/gallery" trackingCategory="services_section">
                view our past work
              </InternalLink>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeServices;