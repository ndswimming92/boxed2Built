import React, { useEffect } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import About from '../components/sections/About';
import { ChevronRight, Phone, Calendar, CheckCircle, Users, Clock, Award } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';

const AboutPage: React.FC = () => {
  useEffect(() => {
    document.title = 'About Boxed2Built - Professional Furniture Assembly in Spring Hill, TN';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Learn about Boxed2Built, Spring Hill\'s trusted furniture assembly service. Professional IKEA, Target, Walmart assembly with local expertise and reliable service.');
    }
  }, []);

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-about-page');
    window.open(getCalendlyUrl('services'), '_blank');
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-about-page');
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-600 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">About</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                About Boxed2Built
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Spring Hill's trusted furniture assembly service, dedicated to making your life easier 
                with professional, reliable furniture assembly for all major brands.
              </p>
            </div>
          </div>
        </section>

        {/* About Section */}
        <About />

        {/* Our Story */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Boxed2Built was founded with a simple mission: to help busy families and professionals 
                    in Spring Hill, TN enjoy their new furniture without the stress and time commitment of assembly.
                  </p>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    We understand that your time is valuable, and furniture assembly can be frustrating and time-consuming. 
                    That's why we've dedicated ourselves to providing professional, efficient, and reliable assembly services 
                    for all major furniture brands including IKEA, Target, Walmart, and more.
                  </p>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    As a local Spring Hill business, we're committed to serving our community with integrity, 
                    professionalism, and the highest quality service standards.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={handleBookingClick}
                      variant="primary"
                      size="lg"
                      trackingLabel="book-consultation-about-story"
                    >
                      <Calendar size={20} className="mr-2" />
                      Book Service
                    </Button>
                    <a
                      href="tel:+16154034538"
                      onClick={handlePhoneClick}
                      className="inline-flex items-center justify-center px-6 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                    >
                      <Phone size={20} className="mr-2" />
                      Call (615) 403-4538
                    </a>
                  </div>
                </div>
                
                <div className="relative">
                  <img 
                    src="https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                    alt="Professional furniture assembly tools and workspace" 
                    className="rounded-lg shadow-lg"
                    loading="lazy"
                    width="630"
                    height="420"
                  />
                  <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
                    <p className="font-semibold">Professional Tools</p>
                    <p className="text-sm text-blue-100">Quality Assembly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Values */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Our Values</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Award className="text-blue-600" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Quality First</h3>
                  <p className="text-gray-600">
                    We take pride in our work and ensure every piece of furniture is assembled to the highest standards 
                    with attention to detail and craftsmanship.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="text-green-600" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Reliability</h3>
                  <p className="text-gray-600">
                    We show up on time, complete projects efficiently, and communicate clearly throughout the process. 
                    Your time is valuable, and we respect that.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="text-purple-600" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Community Focus</h3>
                  <p className="text-gray-600">
                    As a local Spring Hill business, we're invested in our community and committed to building 
                    lasting relationships with our neighbors.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Guarantee */}
        <section className="py-16 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-6">Our Service Guarantee</h2>
              <p className="text-xl text-blue-100 mb-8">
                We stand behind our work with a commitment to quality, professionalism, and customer satisfaction.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
                  <CheckCircle size={32} className="text-white mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Professional Assembly</h3>
                  <p className="text-blue-100">
                    Every piece assembled according to manufacturer specifications with professional tools and techniques.
                  </p>
                </div>
                
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
                  <CheckCircle size={32} className="text-white mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Clean Service</h3>
                  <p className="text-blue-100">
                    We clean up all packaging materials and leave your space cleaner than we found it.
                  </p>
                </div>
              </div>
              
              <Button
                onClick={handleBookingClick}
                variant="white"
                size="lg"
                className="px-8 py-4"
                trackingLabel="book-consultation-about-guarantee"
              >
                Experience Our Service
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default AboutPage;