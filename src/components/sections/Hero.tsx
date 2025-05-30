import React from 'react';
import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

const Hero: React.FC = () => {
  const scrollToContact = () => {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-1/4 w-64 h-64 bg-blue-100 rounded-full opacity-50 transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-48 h-48 bg-green-100 rounded-full opacity-50 transform -translate-x-1/2"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 md:pr-12 mb-10 md:mb-0">
            <div className="animate-fadeIn">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                Furniture Assembly 
                <span className="block text-blue-600">Done For You</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 mb-8">
                From Boxed to Built – We make home setup stress-free.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={scrollToContact}
                  className="group"
                >
                  Get a Free Quote
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <a 
                  href="tel:6154034538" 
                  className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  (615) 403-4538
                </a>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2 relative">
            <div className="bg-white p-3 rounded-lg shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <img 
                src="https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Furniture assembly professional" 
                className="w-full h-auto rounded"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-green-100 p-4 rounded-lg shadow-md transform -rotate-2 hover:rotate-0 transition-transform duration-300">
              <p className="text-green-800 font-medium text-sm">
                "We assemble so you don't have to!"
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;