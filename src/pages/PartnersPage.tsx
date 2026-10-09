import React, { useEffect } from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  Phone,
  Download,
  Gift,
  Tag,
  Clock,
  Home,
  KeyRound,
  BedDouble,
} from 'lucide-react';
import { trackEvent } from '../utils/analytics';

import { Head } from 'vite-react-ssg';
import { formatPhoneForDisplay } from '../services/communicationService';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';
import { useBusinessLoaderData } from '../hooks/useBusinessLoaderData';
import { hostRoomPriceLabel } from '../constants/hostPartners';

const PartnersPage: React.FC = () => {
  const businessData = useBusinessLoaderData();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || '+16154034538').replace(/^\+1/, ''));

  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Boxed2Built Partnership Program',
      description: 'Partner with Boxed2Built for realtor closing gifts and mover referrals. Professional furniture assembly services in Spring Hill, TN.',
      url: 'https://boxed2built.com/partners',
      mainEntity: {
        '@type': 'Service',
        name: 'Partnership Program',
        provider: {
          '@type': 'LocalBusiness',
          name: 'Boxed2Built',
          telephone: '+16154034538',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Spring Hill',
            addressRegion: 'TN',
            addressCountry: 'US'
          }
        },
        areaServed: {
          '@type': 'State',
          name: 'Tennessee'
        }
      }
    };

    let scriptTag = document.querySelector('script[data-schema="partners"]');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.setAttribute('type', 'application/ld+json');
      scriptTag.setAttribute('data-schema', 'partners');
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(schema);
  }, []);

  const handleContactClick = () => {
    trackEvent('link_click', 'partners_page_hero', {
      event_category: 'navigation',
      event_label: 'contact_link_partners',
      action_type: 'click',
      action_value: '/contact',
    });
  };

  const handleFlyerDownload = async () => {
    trackEvent('file_download', 'partners_page_flyer', {
      event_category: 'download',
      event_label: 'realtor_flyer_download',
      action_type: 'download',
      action_value: 'realtor_flyer_pdf',
    });

    const { generateRealtorFlyerPDF } = await import('../utils/realtorFlyerPDF');
    await generateRealtorFlyerPDF(businessData);
  };

  const handleHostFlyerDownload = async () => {
    trackEvent('file_download', 'partners_page_host_flyer', {
      event_category: 'download',
      event_label: 'host_flyer_download',
      action_type: 'download',
      action_value: 'host_flyer_pdf',
    });

    const { generateHostFlyerPDF } = await import('../utils/hostFlyerPDF');
    await generateHostFlyerPDF(businessData);
  };

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.partners.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.partners.description} />
        <link rel="canonical" href="https://boxed2built.com/partners" />
        <meta property="og:url" content="https://boxed2built.com/partners" />
        <meta property="og:title" content="Boxed2Built Partnerships | Realtors & Movers in Spring Hill" />
        <meta property="og:description" content="Partner with Boxed2Built to add furniture assembly value for your customers. Referral benefits and closing gift options in Spring Hill, TN." />
        <meta name="twitter:title" content="Partner with Boxed2Built | Spring Hill, TN" />
        <meta name="twitter:description" content="Add furniture assembly value for your customers. Referral benefits and closing gift options for realtors and movers." />
      </Head>
      <Header />

      <noscript>
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f3f4f6' }}>
          <h2>Partner with Boxed2Built</h2>
          <p>Professional furniture assembly partnerships for realtors and movers in Spring Hill, TN.</p>
          <p>Call us at {phoneDisplay} or visit our contact page.</p>
        </div>
      </noscript>

      {/* Matches About page header spacing */}
      <main className="pt-20">
        {/* HERO + BREADCRUMBS (combined like About page) */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Partners', href: '/partners', current: true },
                ]}
                className="mb-6"
              />

              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                Partner with Boxed2Built
              </h1>

              <p className="text-base sm:text-lg md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Give your clients a stress-free move-in. We assemble furniture so buyers enjoy their new home day one.
              </p>

              <div className="flex justify-center">
                <a
                  href="/contact"
                  onClick={handleContactClick}
                  className="inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base"
                >
                  Contact Us
                </a>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-gray-600">
                Built for Realtors, Airbnb Hosts, Property Managers, Movers, and Local Partners across Spring Hill & Middle TN.
              </p>
            </div>
          </div>
        </section>

        {/* FOR REALTORS */}
        <section className="py-10 md:py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
                For Realtors
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="text-blue-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Closing gift customers actually use</h3>
                  <p className="text-sm text-gray-600">
                    Professional{' '}
                    <a href="/services/furniture-assembly" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      furniture assembly
                    </a>{' '}
                    your buyers will appreciate on day one.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="text-green-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Fast help for move-in day</h3>
                  <p className="text-sm text-gray-600">
                    We coordinate directly with closing timelines and buyer schedules.
                    See our{' '}
                    <a href="/gallery" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      completed projects
                    </a>{' '}
                    for real examples.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Tag className="text-purple-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Discount code tied to your name</h3>
                  <p className="text-sm text-gray-600">
                    Track referrals and provide added value with personalized codes.
                    View our{' '}
                    <a href="/services" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      services &amp; pricing
                    </a>{' '}
                    to share with clients.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleFlyerDownload}
                  className="inline-flex items-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Download size={18} className="mr-2" />
                  Download Realtor Flyer (PDF)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FOR HOSTS & PROPERTY MANAGERS */}
        <section id="hosts" className="py-10 md:py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
                For Airbnb Hosts, Landlords &amp; Property Managers
              </h2>
              <p className="text-sm sm:text-base text-gray-600 text-center max-w-2xl mx-auto mb-8">
                Need a unit furnished in one visit? We unbox and assemble everything so it is ready for guests or tenants.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Home className="text-blue-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">A whole unit furnished in one visit</h3>
                  <p className="text-sm text-gray-600">
                    Beds, dressers, desks and shelving assembled and placed room by room. See our{' '}
                    <a href="/gallery" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      completed projects
                    </a>{' '}
                    for real examples.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="text-green-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Fast turnarounds</h3>
                  <p className="text-sm text-gray-600">
                    We work around your booking calendar and move-in dates so units are not sitting empty.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BedDouble className="text-purple-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Simple per-room pricing</h3>
                  <p className="text-sm text-gray-600">
                    {hostRoomPriceLabel()} See our{' '}
                    <a href="/services" className="text-blue-700 hover:text-blue-800 underline font-medium">
                      services &amp; pricing
                    </a>{' '}
                    for per-item rates.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/contact"
                  onClick={handleContactClick}
                  className="inline-flex items-center px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Phone size={18} className="mr-2" />
                  Request a Quote
                </a>
                <button
                  onClick={handleHostFlyerDownload}
                  className="inline-flex items-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Download size={18} className="mr-2" />
                  Download Host Flyer (PDF)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <div className="mt-12">
          <ErrorBoundary>
            <Testimonials />
          </ErrorBoundary>
        </div>

        {/* FINAL CTA */}
        <section className="py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to make move-in effortless?
              </h2>
              <p className="text-blue-50 mb-6">
                Partner with Boxed2Built and give your clients a stress-free first day at home.
              </p>

              <a
                href="/contact"
                onClick={handleContactClick}
                className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 rounded-lg font-medium"
              >
                <Phone size={18} className="mr-2" />
                Contact Us Today
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default PartnersPage;
