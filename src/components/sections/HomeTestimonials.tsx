import React from 'react';
import { Star, Quote } from 'lucide-react';

const HomeTestimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Jessica T.',
      location: 'Spring Hill',
      content: 'Boxed2Built saved my weekend! They assembled my entertainment center in just 2 hours. Professional and worth every penny.',
      rating: 5
    },
    {
      name: 'Michael R.',
      location: 'Franklin',
      content: 'Moving with IKEA furniture was stressful until I called Boxed2Built. They made it look effortless. Highly recommend!',
      rating: 5
    },
    {
      name: 'Sarah K.',
      location: 'Columbia',
      content: 'Needed office furniture assembled quickly. Boxed2Built delivered exceptional service and perfect assembly.',
      rating: 5
    }
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what Spring Hill area residents say about our furniture assembly service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center mb-4">
                <Quote className="text-blue-600 mr-2" size={20} />
                <div className="flex">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="text-yellow-400 fill-current" size={16} />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 mb-4 italic">"{testimonial.content}"</p>
              <div className="border-t pt-4">
                <p className="font-semibold text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-500">{testimonial.location}, TN</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomeTestimonials;