import React from 'react';
import { Heart, Users, Clock, CheckCircle, Award } from 'lucide-react';

const About: React.FC = () => {
  return (
    <section id="about" className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">

        {/* Enhanced Why Choose Us with more keywords */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Why Choose Boxed2Built for Furniture Assembly in Spring Hill, TN?
          </h2>
          
          <div className="bg-white p-8 rounded-lg shadow-md mb-10">
            <p className="text-xl text-gray-700 mb-6 leading-relaxed">
              As Spring Hill's trusted furniture assembly experts, we understand that busy families need reliable, professional service. 
              Whether it's IKEA, Target, Walmart, or any major furniture brand, we handle the assembly so you can focus on what matters most.
            </p>
            
            <p className="text-2xl font-medium text-blue-600 italic">
              We don't just build furniture—we build peace of mind for Tennessee families.
            </p>
          </div>

          {/* Enhanced trust indicators without ratings/licensing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Award className="text-blue-600" size={32} />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Professional Service</h4>
              <p className="text-gray-600">Expert furniture assembly with attention to detail and quality craftsmanship</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Clock className="text-green-600" size={32} />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Flexible Scheduling</h4>
              <p className="text-gray-600">Convenient scheduling that works with your busy lifestyle and timeline</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="text-purple-600" size={32} />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Local Service</h4>
              <p className="text-gray-600">Proudly serving Spring Hill and surrounding Tennessee communities</p>
            </div>
          </div>

          {/* What You Can Expect - Enhanced with keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <Heart className="text-blue-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Expert IKEA Assembly</h4>
                  <p className="text-gray-600">Specialized in IKEA furniture with years of experience in complex assembly projects</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Professional & Clean</h4>
                  <p className="text-gray-600">Punctual service that leaves your space cleaner than we found it</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Local Service Area with more keywords */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-lg shadow-md">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                <img 
                  src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                  alt="Professional furniture assembly service in Spring Hill Tennessee" 
                  className="rounded-lg shadow-md"
                  loading="lazy"
                  width="630"
                  height="420"
                />
              </div>
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Proudly Serving Spring Hill, TN & Middle Tennessee
                </h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  As a local Spring Hill furniture assembly company, we understand the needs of Tennessee families. 
                  From single chairs to complete bedroom sets, we provide honest work with a helpful attitude throughout 
                  Williamson County and Maury County.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Spring Hill, TN', 
                    'Columbia, TN', 
                    'Franklin, TN', 
                    'Thompson\'s Station', 
                    'Brentwood, TN',
                    'Nashville Metro'
                  ].map((area, index) => (
                    <div key={index} className="flex items-center">
                      <CheckCircle size={16} className="text-green-600 mr-2" />
                      <span className="text-sm font-medium">{area}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-white rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Service Guarantee:</strong> Professional assembly, cleanup included, 
                    satisfaction guaranteed on all IKEA, Target, Walmart and major brand furniture.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;