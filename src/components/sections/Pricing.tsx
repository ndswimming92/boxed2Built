import React from 'react';
import { DollarSign, CheckCircle } from 'lucide-react';

const Pricing: React.FC = () => {
  const pricingItems = [
    { name: 'Chairs & Seating', price: '$85+', color: 'blue' },
    { name: 'Desks & Tables', price: '$185+', color: 'green' },
    { name: 'Dressers & Storage', price: '$320+', color: 'amber' },
    { name: 'Beds & Frames', price: '$295+', color: 'slate' },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <DollarSign className="text-blue-600" size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              No hidden fees. No surprises. Get a free custom quote for your specific furniture assembly needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {pricingItems.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-600 hover:shadow-lg transition-all duration-200"
              >
                <div className="text-sm font-medium text-gray-600 mb-2">{item.name}</div>
                <div className={`text-3xl font-bold text-${item.color}-600 mb-1`}>{item.price}</div>
                <div className="text-xs text-gray-500">Starting price</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              What's Included In Every Service
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <CheckCircle size={20} className="text-green-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Complete Assembly</div>
                  <div className="text-sm text-gray-600">Professional setup from box to finished product</div>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle size={20} className="text-green-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Packaging Removal</div>
                  <div className="text-sm text-gray-600">We clean up and remove all boxes and materials</div>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle size={20} className="text-green-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Proper Placement</div>
                  <div className="text-sm text-gray-600">Positioned exactly where you want it</div>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle size={20} className="text-green-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">Quality Guarantee</div>
                  <div className="text-sm text-gray-600">100% satisfaction or we make it right</div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Prices vary based on furniture complexity and size. Contact us for a personalized quote for your specific items.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
