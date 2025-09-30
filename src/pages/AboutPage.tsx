import React, { useEffect } from 'react';
import LocalBusinessSchema from '../components/seo/LocalBusinessSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import About from '../components/sections/About';
import { ChevronRight, Phone, Calendar, CheckCircle, Users, Clock, Award } from 'lucide-react';
import Button from '../components/ui/Button';
import OptimizedImage from '../components/ui/OptimizedImage';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';
import { 
  BUSINESS_INFO, 
  ADDRESS_INFO, 
  SERVICE_AREAS, 
  PRIMARY_SERVICES, 
  SOCIAL_MEDIA_URLS,
  CUSTOMER_REVIEWS,
  LOCAL_SEO_CONTENT
} from '../constants/localSEO';

const AboutPage: React.FC = () => {
  useEffect(() => {
    document.title = LOCAL_SEO_CONTENT.about.title;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', LOCAL_SEO_CONTENT.about.description);
    }

    // Set canonical URL for this page
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/about');
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
      <LocalBusinessSchema
        phone={BUSINESS_INFO.phone}
        email={BUSINESS_INFO.email}
        website={BUSINESS_INFO.website}
        serviceAreas={SERVICE_AREAS}
        services={PRIMARY_SERVICES}
        socialMediaUrls={SOCIAL_MEDIA_URLS}
        reviews={CUSTOMER_REVIEWS}
      />
      <Header />
      <Breadcrumbs 
        items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about', current: true }
        ]}
        className="container mx-auto px-4 pt-24 pb-4"
      />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-700 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">About</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                About Your Spring Hill Handyman Services – Furniture Assembly Specialists
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Your trusted Spring Hill handyman services team, dedicated to making your life easier 
                with professional furniture assembly for IKEA, Target, Walmart, and all major brands.
              </p>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              
              {/* Meet the Owner */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Meet the Owner</h2>
                  <p className="text-xl text-gray-700 mb-6 font-medium">
                    Hi, I'm Nicholas Davidson, the hands (and heart) behind Boxed2Built.
                  </p>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    Ever since I was a kid, I've loved opening a new box of furniture and figuring out how it all fits together. 
                    What started as a fun challenge in my childhood has grown into a passion for helping families feel settled 
                    and stress-free in their homes. Explore our{' '}
                    <a href="/services" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      full range of services
                    </a>{' '}
                    to see how we can help your family.
                  </p>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    I know what it's like to have a packed schedule and a pile of furniture waiting—and I'm here to make sure 
                    you don't have to choose between your time and your peace of mind.
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    I take pride in delivering reliable, friendly service with a family-first mindset—because I believe your 
                    home should be a place of rest, not one more thing to assemble.
                  </p>
                </div>
                
                <div className="relative">
                  <OptimizedImage
                    src="https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                    alt="Nicholas Davidson - Professional furniture assembly expert in Spring Hill Tennessee" 
                    className="rounded-lg shadow-lg object-cover"
                    width="500"
                    height="333"
                    imageType="gallery"
                    quality={85}
                    enableAvif={true}
                  />
                  <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
                    <p className="font-semibold">Nicholas Davidson</p>
                    <p className="text-sm text-blue-100">Owner & Founder</p>
                  </div>
                </div>
              </div>

              {/* Mission Statement */}
              <div className="bg-blue-50 p-8 rounded-lg shadow-md mb-16">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">Our Mission</h2>
                <p className="text-2xl text-blue-600 font-medium text-center italic mb-6">
                  We turn boxes into comfort so families can focus on what matters most.
                </p>
                <p className="text-gray-700 leading-relaxed text-center max-w-3xl mx-auto">
                  Boxed2Built was born from a simple love of building. As a kid, I was always the first to tear into a new box 
                  of furniture, lay out the parts, and figure out how to bring it all together. There was something deeply 
                  satisfying about turning a pile of pieces into something useful, sturdy, and ready to enjoy. That feeling 
                  never left—and now, it's the heart of what we do every day.
                </p>
              </div>

              {/* Why We Exist */}
              <div className="mb-16">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Why We Exist</h2>
                <p className="text-gray-700 mb-6 leading-relaxed text-lg">
                  Families today are busier than ever. Between work, kids, and the endless to-do list, furniture assembly 
                  shouldn't be one more thing weighing you down. At Boxed2Built, we step in to take the stress off your 
                  shoulders—so you can spend more time making memories and less time making sense of confusing instructions.
                </p>
                <p className="text-xl text-blue-600 font-medium italic">
                  We don't just build furniture—we build peace of mind, one piece at a time.
                </p>
              </div>

              {/* What You Can Expect */}
              <div className="mb-16">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">What You Can Expect</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                        <Award className="text-blue-600" size={24} />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">Professional Service</h3>
                    </div>
                    <p className="text-gray-700">From someone who actually enjoys the process and takes pride in quality work</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <Clock className="text-green-600" size={24} />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">Punctual & Reliable</h3>
                    </div>
                    <p className="text-gray-700">Scheduling that respects your time and commitments</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="text-purple-600" size={24} />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">Clean & Tidy</h3>
                    </div>
                    <p className="text-gray-700">Your space will look better than we found it</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-amber-600">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mr-4">
                        <Users className="text-amber-600" size={24} />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">Family-Focused</h3>
                    </div>
                    <p className="text-gray-700">We treat your home with the care we'd want in ours</p>
                  </div>
                </div>
              </div>

              {/* Serving Our Community */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-lg shadow-md">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">Serving Our Community</h2>
                <p className="text-gray-700 leading-relaxed text-center max-w-3xl mx-auto mb-6">
                  Based in Spring Hill, TN, we proudly serve local families in the surrounding area with honest work and 
                  a helpful attitude. Whether it's a single chair or a whole nursery setup, we're here to make your life 
                  a little easier—and your home a lot more comfortable.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  {[
                    'Spring Hill, TN', 
                    'Columbia, TN', 
                    'Franklin, TN', 
                    'Thompson\'s Station', 
                    'Brentwood, TN',
                    'Nashville Metro'
                  ].map((area, index) => (
                    <div key={index} className="flex items-center justify-center bg-white p-3 rounded-lg shadow-sm">
                      <CheckCircle size={16} className="text-green-700 mr-2" />
                      <span className="text-sm font-medium text-gray-700">{area}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Guarantee */}
        <section className="py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-6">Ready to Get Started?</h2>
              <p className="text-xl text-blue-50 mb-8">
                Let Nicholas and the Boxed2Built team take the stress out of furniture assembly for your Spring Hill area home.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Button
                  onClick={handleBookingClick}
                  variant="white"
                  size="lg"
                  trackingLabel="book-consultation-about-cta"
                >
                  <Calendar size={20} className="mr-2" />
                  Book Free Consultation
                </Button>
                <a
                  href="tel:+19316741196"
                  onClick={handlePhoneClick}
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Phone size={18} className="mr-2" />
                  <span className="mr-2">Call</span>
                  <span className="font-bold text-white">(931) 674-1196</span>
                </a>
              </div>
              
              <p className="text-xs text-blue-50 font-medium">
                By submitting any request, you agree to our Terms of Service
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default AboutPage;