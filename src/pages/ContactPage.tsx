import React from 'react';
import EnhancedLocalBusinessSchema from '../components/seo/EnhancedLocalBusinessSchema';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ContactForm from '../components/ContactForm';
import BookingCallout from '../components/sections/BookingCallout';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import CallButton from '../components/ui/CallButton';
import { trackEvent } from '../utils/analytics';

import { Head } from 'vite-react-ssg';
import { formatPhoneForDisplay, formatPhoneForSchema } from '../utils/phoneFormatting';
import { useBusinessLoaderData } from '../hooks/useBusinessLoaderData';
import {
  LOCAL_SEO_CONTENT,
  getLocalSeoContentWithPhone
} from '../constants/localSEO';

const ContactPage: React.FC = () => {
  const businessData = useBusinessLoaderData();

  const phoneRaw = businessData?.info?.phone;
  const phoneMachine = formatPhoneForSchema(phoneRaw);
  const phoneDisplay = formatPhoneForDisplay(phoneMachine);
  const localSeoContent = getLocalSeoContentWithPhone({ phone: phoneMachine, phoneDisplay });

  const handlePhoneClick = () => {
    trackEvent('phone_click', 'contact_page_info', {
      event_category: 'contact',
      event_label: 'phone_click_contact_info',
      value: 1,
      element_type: 'link',
      element_location: 'contact_page_info',
      page_section: 'contact_page_info',
      action_type: 'phone_click',
      conversion_type: 'phone_lead'
    });
  };

  const handleEmailClick = () => {
    trackEvent('email_click', 'contact_page_header', {
      event_category: 'contact',
      event_label: 'email_click_contact',
      value: 1,
      element_type: 'link',
      element_location: 'contact_page_header',
      page_section: 'contact_page_header',
      action_type: 'email_click',
      conversion_type: 'email_lead'
    });
    window.location.href = 'mailto:nicholas.davidson@boxed2built.com?subject=Contact%20-%20Contact%20Page&body=I%20would%20like%20to%20inquire%20about%20furniture%20assembly%20services.%0A%0ABy%20submitting%20this%20request,%20I%20agree%20to%20the%20Terms%20of%20Service.%0A%0ASource:%20Contact%20Page';
  };

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.contact.title}</title>
        <meta name="description" content={localSeoContent.contact.description} />
        <link rel="canonical" href="https://boxed2built.com/contact" />
        <meta property="og:url" content="https://boxed2built.com/contact" />
        <meta property="og:title" content="Contact Boxed2Built | Spring Hill Furniture Assembly" />
        <meta property="og:description" content="Get in touch with Boxed2Built for fast, friendly furniture assembly in Spring Hill, TN. Call or email for a free quote." />
        <meta name="twitter:title" content="Contact Boxed2Built | Spring Hill, TN" />
        <meta name="twitter:description" content="Call or email Boxed2Built for professional furniture assembly in Spring Hill, TN. Fast quotes and flexible scheduling." />
      </Head>
      {businessData && (
        <EnhancedLocalBusinessSchema
          businessData={businessData}
          includeReviews={false}
          pageType="contact"
        />
      )}
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs 
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Contact', href: '/contact', current: true }
                ]}
                className="mb-6"
              />
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
  Furniture Assembly & Handyman Services in Spring Hill, TN
</h1>

<p className="text-xl text-gray-600 mb-8">
  Need help with furniture assembly in Spring Hill, TN? Boxed2Built offers reliable IKEA, Target, and Walmart assembly, plus wall mounting and small handyman services.
  Reach out for a free quote and scheduling in Spring Hill and nearby areas like Thompson’s Station, Franklin, and Columbia.
</p>

            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 justify-center">
                
                {/* Contact Details */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">Get In Touch</h2>
                  
                  <div className="space-y-6 mb-8">
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Phone className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Phone</h3>
                        <a 
                          href={`tel:${phoneMachine}`} 
                          className="text-blue-700 hover:text-blue-800 text-lg"
                          onClick={handlePhoneClick}
                        >
                          {phoneDisplay}
                        </a>
                        <p className="text-gray-700 text-sm mt-1">Call for immediate assistance or quotes</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Mail className="text-green-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Email</h3>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
                          className="text-blue-700 hover:text-blue-800"
                        >
                          nicholas.davidson@boxed2built.com
                        </a>
                        <p className="text-gray-700 text-sm mt-1">Send us your furniture assembly questions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <MapPin className="text-purple-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Service Area</h3>
                        <p className="text-gray-700">Spring Hill, TN</p>
                        <p className="text-gray-700 text-sm mt-1">
                          Also serving Columbia, Franklin, Thompson's Station, Brentwood & surrounding areas
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                        <Clock className="text-amber-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Hours</h3>
                        {businessData?.businessHours && businessData.businessHours.length > 0 ? (
                          <>
                            {businessData.businessHours.map((hours) => {
                              const formatTime = (time: string | null) => {
                                if (!time) return '';
                                const [hour, minute] = time.split(':');
                                const hourNum = parseInt(hour);
                                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                                const displayHour = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
                                return `${displayHour}:${minute} ${ampm}`;
                              };

                              return (
                                <p key={hours.id} className="text-gray-700">
                                  {hours.day_of_week}: {hours.is_closed ? 'Closed' : `${formatTime(hours.opens)} - ${formatTime(hours.closes)}`}
                                </p>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <p className="text-gray-700">Saturday: 9:00 AM - 4:00 PM</p>
                            <p className="text-gray-700">Sunday: 1:30 PM - 4:00 PM</p>
                          </>
                        )}
                        <p className="text-gray-700 text-sm mt-1">Flexible scheduling available</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Contact Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <CallButton size="lg" pageSection="contact_page_quick_contact" />
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); handleEmailClick(); }}
                      className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                    >
                      <Mail size={20} className="mr-2" />
                      Email Us
                    </a>
                  </div>
                </div>

                {/* Contact Form */}
                <div>
                  <BookingCallout
                    pageSection="contact_page"
                    body="Skip the back-and-forth — see the days and start times we actually have open and take one. You'll get an email as soon as it's confirmed."
                    className="mb-6"
                  />
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
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
                Frequently Asked Questions
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    How do I schedule furniture assembly service?
                  </h3>
                  <p className="text-gray-600">
                    You can schedule service by calling us at {phoneDisplay}, sending an email, or booking
                    online through our website. We offer flexible scheduling to fit your needs. Once booked,{' '}
                    <a href="/faq#build-day-process" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      learn what to expect on assembly day
                    </a>{' '}
                    to prepare for our arrival.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    What areas do you serve?
                  </h3>
                  <p className="text-gray-600">
                    We provide weekend furniture assembly service in Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding 
                    Tennessee areas. Contact us to confirm service availability in your location.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    How much does furniture assembly cost?
                  </h3>
                  <p className="text-gray-600">
                    Our prices start at $85 for small items like chairs. We provide transparent, upfront 
                    pricing based on the complexity and size of your furniture. Free quotes available.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
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
