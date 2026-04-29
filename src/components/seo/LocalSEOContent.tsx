import React from 'react';
import { MapPin, Clock, Phone, Star } from 'lucide-react';

interface LocalSEOContentProps {
  city: string;
  state: string;
  businessType: string;
  services: string[];
  serviceAreas: string[];
  className?: string;
}

const LocalSEOContent: React.FC<LocalSEOContentProps> = ({
  city,
  state,
  businessType,
  services,
  serviceAreas,
  className = ''
}) => {
  return (
    <section className={`py-8 bg-gray-50 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Local Service Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Professional {businessType} in {city}, {state}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Serving {city} and surrounding {state} communities with expert {businessType.toLowerCase()} services. 
              Local, reliable, and professional service you can trust.
            </p>
          </div>

          {/* Service Areas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Primary Service Area */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center mb-3">
                <MapPin className="text-blue-600 mr-3" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Primary Service Area</h3>
              </div>
              <p className="text-gray-700 font-medium">{city}, {state}</p>
              <p className="text-sm text-gray-600 mt-2">
                Our home base where we provide same-day and next-day service availability.
              </p>
            </div>

            {/* Extended Service Areas */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
              <div className="flex items-center mb-3">
                <Clock className="text-green-600 mr-3" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Extended Areas</h3>
              </div>
              <div className="space-y-1">
                {serviceAreas.slice(1, 4).map((area, index) => (
                  <p key={index} className="text-gray-700 text-sm">{area}</p>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Flexible scheduling available for surrounding communities.
              </p>
            </div>

            {/* Contact Info */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
              <div className="flex items-center mb-3">
                <Phone className="text-purple-600 mr-3" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">Local Contact</h3>
              </div>
              <p className="text-gray-700 font-medium">(615) 551-1402</p>
              <p className="text-sm text-gray-600 mt-2">
                Call for immediate service in {city} and surrounding areas.
              </p>
            </div>
          </div>

          {/* Local Services */}
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              {businessType} Services in {city}, {state}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Star className="text-yellow-500 mr-3 flex-shrink-0" size={16} />
                  <span className="text-gray-700 text-sm">{service} in {city}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                Professional {businessType.toLowerCase()} serving {serviceAreas.join(', ')} and surrounding {state} communities.
              </p>
            </div>
          </div>

          {/* Local SEO Text Block */}
          <div className="mt-8 bg-blue-50 p-6 rounded-lg">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Why Choose Local {city} {businessType}?
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <p className="mb-2">
                  <strong>Local Knowledge:</strong> We understand the {city} community and provide 
                  personalized service that reflects our commitment to {state} families.
                </p>
                <p>
                  <strong>Quick Response:</strong> Being locally based in {city} means faster 
                  response times and flexible scheduling for your convenience.
                </p>
              </div>
              <div>
                <p className="mb-2">
                  <strong>Community Focused:</strong> As a local {city} business, we're invested 
                  in building lasting relationships with our neighbors.
                </p>
                <p>
                  <strong>Area Expertise:</strong> Familiar with {city} and surrounding {state} 
                  areas, ensuring efficient service delivery.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocalSEOContent;