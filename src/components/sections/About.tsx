import React from 'react';
import { Heart, Users, Clock, CheckCircle, ChevronDown } from 'lucide-react';

const About: React.FC = () => {
  const scrollToBooking = () => {
    const bookingSection = document.getElementById('booking');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="about" className="py-16 bg-gray-50 relative">
      <div className="container mx-auto px-4">

        {/* Streamlined Why We Exist */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Why Choose Boxed2Built?</h2>
          
          <div className="bg-white p-8 rounded-lg shadow-md mb-12">
            <p className="text-xl text-gray-700 mb-6 leading-relaxed">
              Families today are busier than ever. Between work, kids, and the endless to-do list, furniture assembly shouldn't be one more thing weighing you down.
            </p>
            
            <p className="text-2xl font-medium text-blue-600 italic">
              We don't just build furniture—we build peace of mind.
            </p>
          </div>

          {/* What You Can Expect - Condensed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <Heart className="text-blue-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Professional & Reliable</h4>
                  <p className="text-gray-600">Quality work from someone who takes pride in the process</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <Clock className="text-green-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Fast & Clean</h4>
                  <p className="text-gray-600">Punctual service that leaves your space better than we found it</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Serving Our Community - Simplified */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-lg shadow-md">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                <img 
                  src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                  alt="Serving Spring Hill community" 
                  className="rounded-lg shadow-md"
                />
              </div>
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Local Spring Hill Service</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Based in Spring Hill, TN, we serve local families with honest work and a helpful attitude. Whether it's a single chair or a whole room setup, we're here to make your life easier.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['Spring Hill', 'Columbia', 'Franklin', 'Thompson\'s Station'].map((area, index) => (
                    <div key={index} className="flex items-center">
                      <CheckCircle size={16} className="text-green-600 mr-2" />
                      <span className="text-sm font-medium">{area}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToBooking}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-2 py-2 shadow-md hover:shadow-lg animate-bounce"
          aria-label="Book your service"
        >
          <span className="text-xs font-medium mb-0.5">Book Now</span>
          <ChevronDown size={16} className="text-blue-600" />
        </button>
      </div>
    </section>
  );
};

export default About;