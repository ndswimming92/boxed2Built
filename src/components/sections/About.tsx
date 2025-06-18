import React from 'react';
import { PenTool as Tool, CheckCircle, Clock, ChevronDown } from 'lucide-react';

const About: React.FC = () => {
  const scrollToServices = () => {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="about" className="py-16 bg-white relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose <span className="text-blue-600">Boxed2Built</span>?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We're a local, family-run business serving Spring Hill and the surrounding area with honest, affordable furniture assembly. At Boxed2Built, we turn confusing instructions and scattered parts into solid, ready-to-use furniture—quickly and carefully. No stress, no mess, just reliable service you can count on.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-blue-50 p-6 rounded-lg shadow-md transform transition-transform duration-300 hover:-translate-y-2">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Tool className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Skilled & Efficient</h3>
            <p className="text-gray-600">
              With hands-on experience assembling hundreds of furniture items, we know the shortcuts and best practices to get the job done right—fast and hassle-free.
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow-md transform transition-transform duration-300 hover:-translate-y-2">
            <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Built to Last</h3>
            <p className="text-gray-600">
              Every piece is assembled with care and precision, solid construction—so your furniture looks great and holds up to daily life.
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow-md transform transition-transform duration-300 hover:-translate-y-2">
            <div className="w-14 h-14 bg-amber-600 rounded-full flex items-center justify-center mb-4">
              <Clock className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Time-Saving</h3>
            <p className="text-gray-600">
              What might take you hours (or days) takes us a fraction of the time, giving you back your precious free time.
            </p>
          </div>
        </div>

        <div className="mt-12 bg-gray-50 p-8 rounded-lg shadow-md mb-16">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pr-8">
              <img 
                src="https://images.pexels.com/photos/5824901/pexels-photo-5824901.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Furniture assembly service" 
                className="rounded-lg shadow-md"
              />
            </div>
            <div className="md:w-1/2">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Serving Spring Hill and Surrounding Areas</h3>
              <p className="text-gray-600 mb-6">
                Based in Spring Hill, Tennessee, we provide furniture assembly services to homes and businesses throughout the area. Whether you've just purchased new furniture from IKEA, Target, Walmart, or any other retailer, we're here to make sure it's assembled correctly and quickly.
              </p>
              <ul className="space-y-3">
                {['Spring Hill', 'Columbia', 'Franklin', 'Thompson\'s Station', 'Brentwood'].map((area, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator - improved positioning and visibility */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToServices}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-4 py-3 shadow-lg hover:shadow-xl animate-bounce"
          aria-label="View our services and pricing"
        >
          <span className="text-sm font-semibold mb-1">View Pricing</span>
          <ChevronDown size={24} className="text-blue-600" />
        </button>
      </div>
    </section>
  );
};

export default About;