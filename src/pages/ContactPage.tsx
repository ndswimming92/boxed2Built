import React, { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ContactForm from '../components/ContactForm';
import { ChevronRight, Phone, Mail, MapPin, Clock, Calendar, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';

const ContactPage: React.FC = () => {
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    document.title = 'Contact Boxed2Built - Same Day Furniture Assembly Spring Hill TN | Free Quotes';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Contact Boxed2Built for same day flat pack furniture assembly Spring Hill TN. Call (931) 674-1196 or book online. IKEA, Target, Walmart, Lowe\'s assembly service.');
    }
  }, []);

  const handleBookingClick = () => {
    if (!acceptTerms) {
      alert('Please accept the Terms of Service to continue.');
      return;
    }
    trackEvent('calendly-booking-click-contact-page');
    window.open(getCalendlyUrl('booking'), '_blank');
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-contact-page');
  };

  const handleEmailClick = () => {
    trackEvent('email-click-contact-page');
    window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Contact%20-%20Contact%20Page&body=I%20would%20like%20to%20inquire%20about%20furniture%20assembly%20services.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Contact%20Page';
  };

  const handleTermsClick = () => {
    trackEvent('terms-link-click-contact');
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-600 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">Contact</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Contact Boxed2Built
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Ready for professional furniture assembly in Spring Hill, TN? Get in touch for a free consultation 
                and quote for your IKEA, Target, or Walmart furniture assembly project.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                
                {/* Contact Details */}
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-8">Get In Touch</h2>
                  
                  <div className="space-y-6 mb-8">
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Phone className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Phone</h3>
                        <a 
                          href="tel:+19316741196" 
                          className="text-blue-600 hover:text-blue-800 text-lg"
                          onClick={handlePhoneClick}
                        >
                          (931) 674-1196
                        </a>
                        <p className="text-gray-600 text-sm mt-1">Call for immediate assistance or quotes</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Mail className="text-green-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Email</h3>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          boxed2builtco@gmail.com
                        </a>
                        <p className="text-gray-600 text-sm mt-1">Send us your furniture assembly questions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <MapPin className="text-purple-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Service Area</h3>
                        <p className="text-gray-600">Spring Hill, TN</p>
                        <p className="text-gray-600 text-sm mt-1">
                          Also serving Columbia, Franklin, Thompson's Station, Brentwood & surrounding areas
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Clock className="text-amber-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Hours</h3>
                        <p className="text-gray-600">Monday - Saturday: 8:00 AM - 5:00 PM</p>
                        <p className="text-gray-600 text-sm mt-1">Flexible scheduling available</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Contact Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href="tel:+19316741196"
                      onClick={handlePhoneClick}
                      className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Phone size={20} className="mr-2" />
                      Call Now
                    </a>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
                      className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Mail size={20} className="mr-2" />
                      Send Email
                    </a>
                  </div>
                </div>

                {/* Quick Booking */}
                <div className="bg-gray-50 p-8 rounded-lg lg:col-span-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Book Free Consultation</h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center text-gray-700">
                      <CheckCircle size={18} className="text-green-600 mr-3" />
                      <span>Free consultation and detailed quote</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <CheckCircle size={18} className="text-green-600 mr-3" />
                      <span>Flexible scheduling including weekends</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <CheckCircle size={18} className="text-green-600 mr-3" />
                      <span>Professional service guarantee</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <CheckCircle size={18} className="text-green-600 mr-3" />
                      <span>Serving Spring Hill and surrounding areas</span>
                    </div>
                  </div>

                  {/* Terms acceptance checkbox */}
                  <div className="mb-6">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">
                        I accept the{' '}
                        <a
                          href="/terms-of-service"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={handleTermsClick}
                        >
                          Terms of Service
                        </a>
                      </span>
                    </label>
                  </div>

                  <Button
                    onClick={handleBookingClick}
                    variant="primary"
                    size="lg"
                    className={`w-full px-8 py-4 text-lg font-semibold ${
                      !acceptTerms ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!acceptTerms}
                    trackingLabel="book-consultation-contact"
                  >
                    <Calendar size={24} className="mr-3" />
                    Book Free Consultation
                  </Button>

                  <p className="text-xs text-gray-500 mt-4 text-center">
                    By submitting, you agree to our Terms of Service • Available weekends • 
                    Serving Spring Hill, Columbia, Franklin & surrounding Tennessee areas
                  </p>
                </div>

                {/* Contact Form */}
                <div className="lg:col-span-1">
                  <ContactForm />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Frequently Asked Questions
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    How do I schedule furniture assembly service?
                  </h3>
                  <p className="text-gray-600">
                    You can schedule service by calling us at (931) 674-1196, sending an email, or booking 
                    online through our website. We offer flexible scheduling to fit your needs.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    What areas do you serve?
                  </h3>
                  <p className="text-gray-600">
                    We serve Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding 
                    Tennessee areas. Contact us to confirm service availability in your location.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    How much does furniture assembly cost?
                  </h3>
                  <p className="text-gray-600">
                    Our prices start at $41 for small items like chairs. We provide transparent, upfront 
                    pricing based on the complexity and size of your furniture. Free quotes available.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Do you assemble all furniture brands?
                  </h3>
                  <p className="text-gray-600">
                    Yes, we assemble furniture from all major brands including IKEA, Target, Walmart, 
                    and many others. We're experienced with all types of furniture assembly instructions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default ContactPage;