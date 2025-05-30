import React from 'react';
import { PenTool as Tool, CheckCircle, Clock } from 'lucide-react';

const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose <span className="text-blue-600">Boxed2Built</span>?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Boxed2Built is your local furniture assembly pro. We save you hours of frustration by turning those confusing instructions into finished furniture—fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-blue-50 p-6 rounded-lg shadow-md transform transition-transform duration-300 hover:-translate-y-2">
            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Tool className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional Expertise</h3>
            <p className="text-gray-600">
              We've assembled thousands of furniture items and know all the tricks to make the process quick and efficient.
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow-md transform transition-transform duration-300 hover:-translate-y-2">
            <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Guaranteed</h3>
            <p className="text-gray-600">
              Every piece is assembled with care and precision, ensuring stability, proper alignment, and durability.
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

        <div className="mt-16 bg-gray-50 p-8 rounded-lg shadow-md">
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
    </section>
  );
};

export default About;