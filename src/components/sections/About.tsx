import React from 'react';
import { Heart, Users, Clock, CheckCircle, ChevronDown } from 'lucide-react';

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
        {/* Meet the Owner Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Meet the Owner
            </h2>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/3">
              <div className="bg-blue-50 p-6 rounded-lg shadow-md">
                <img 
                  src="https://images.pexels.com/photos/5824901/pexels-photo-5824901.jpeg?auto=compress&cs=tinysrgb&w=800&h=800&dpr=2" 
                  alt="Nicholas Davidson - Owner of Boxed2Built" 
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Nicholas Davidson</h3>
                  <p className="text-blue-600 font-medium">Founder & Owner</p>
                </div>
              </div>
            </div>

            <div className="lg:w-2/3">
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Hi, I'm Nicholas Davidson, the hands (and heart) behind Boxed2Built.
                </p>
                
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Ever since I was a kid, I've loved opening a new box of furniture and figuring out how it all fits together. What started as a fun challenge in my childhood has grown into a passion for helping families feel settled and stress-free in their homes. I know what it's like to have a packed schedule and a pile of furniture waiting—and I'm here to make sure you don't have to choose between your time and your peace of mind.
                </p>

                <p className="text-gray-700 leading-relaxed">
                  I take pride in delivering reliable, friendly service with a family-first mindset—because I believe your home should be a place of rest, not one more thing to assemble.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mission Statement */}
        <div className="bg-blue-600 text-white p-8 rounded-lg shadow-md mb-16">
          <div className="text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Our Mission</h3>
            <p className="text-xl md:text-2xl font-light italic">
              We turn boxes into comfort so families can focus on what matters most.
            </p>
          </div>
        </div>

        {/* Our Story */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Our Story</h3>
          </div>
          
          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="mb-6 leading-relaxed">
              Boxed2Built was born from a simple love of building. As a kid, I was always the first to tear into a new box of furniture, lay out the parts, and figure out how to bring it all together. There was something deeply satisfying about turning a pile of pieces into something useful, sturdy, and ready to enjoy. That feeling never left—and now, it's the heart of what we do every day.
            </p>
          </div>
        </div>

        {/* Why We Exist */}
        <div className="bg-gray-50 p-8 rounded-lg shadow-md mb-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">Why We Exist</h3>
            
            <div className="prose prose-lg max-w-none text-gray-700 mb-8">
              <p className="mb-6 leading-relaxed">
                Families today are busier than ever. Between work, kids, and the endless to-do list, furniture assembly shouldn't be one more thing weighing you down. At Boxed2Built, we step in to take the stress off your shoulders—so you can spend more time making memories and less time making sense of confusing instructions.
              </p>
              
              <p className="text-center text-xl font-medium text-blue-600 italic">
                We don't just build furniture—we build peace of mind, one piece at a time.
              </p>
            </div>
          </div>
        </div>

        {/* What You Can Expect */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">What You Can Expect</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                  <Heart className="text-blue-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Professional Service</h4>
                  <p className="text-gray-600">From someone who actually enjoys the process and takes pride in quality work</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                  <Clock className="text-green-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Punctual & Reliable</h4>
                  <p className="text-gray-600">Scheduling that respects your time and commitments</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-amber-600">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                  <CheckCircle className="text-amber-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Clean & Tidy</h4>
                  <p className="text-gray-600">Your space will look better than we found it—guaranteed</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                  <Users className="text-purple-600" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Family-Focused Mindset</h4>
                  <p className="text-gray-600">We treat your home with the care we'd want in ours</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Serving Our Community */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-lg shadow-md mb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-8 md:mb-0 md:pr-8">
                <img 
                  src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                  alt="Serving Spring Hill community" 
                  className="rounded-lg shadow-md"
                />
              </div>
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Serving Our Community</h3>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Based in Spring Hill, TN, we proudly serve local families in the surrounding area with honest work and a helpful attitude. Whether it's a single chair or a whole nursery setup, we're here to make your life a little easier—and your home a lot more comfortable.
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
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={scrollToServices}
          className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-2 py-2 shadow-md hover:shadow-lg animate-bounce"
          aria-label="View our services and pricing"
        >
          <span className="text-xs font-medium mb-0.5">View Pricing</span>
          <ChevronDown size={16} className="text-blue-600" />
        </button>
      </div>
    </section>
  );
};

export default About;