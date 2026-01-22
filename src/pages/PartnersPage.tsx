import React, { useEffect } from 'react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';
import {
  Phone,
  CheckCircle,
  Download,
  Gift,
  Users,
  Tag,
  Clock,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import jsPDF from 'jspdf';

const PartnersPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Boxed2Built Partnerships | Realtors & Movers in Spring Hill';

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        'Realtors & movers—add value for clients with Boxed2Built furniture assembly partnerships. Stress-free move-ins, referral benefits & closing gifts.'
      );
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/partners');
  }, []);

  const handleContactClick = () => {
    trackEvent('link_click', 'partners_page_hero', {
      event_category: 'navigation',
      event_label: 'contact_link_partners',
      action_type: 'click',
      action_value: '/contact',
    });
  };

  const handleFlyerDownload = () => {
    trackEvent('file_download', 'partners_page_flyer', {
      event_category: 'download',
      event_label: 'realtor_flyer_download',
      action_type: 'download',
      action_value: 'realtor_flyer_pdf',
    });

    const pdf = new jsPDF();
    pdf.text('Boxed2Built Realtor Partnership Program', 20, 20);
    pdf.save('Boxed2Built-Realtor-Partnership-Program.pdf');
  };

  return (
    <>
      <Header />

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
                Built for Realtors, Movers, and Local Partners across Spring Hill & Middle TN.
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
                  <h3 className="font-semibold mb-2">Closing gift clients actually use</h3>
                  <p className="text-sm text-gray-600">
                    Professional furniture assembly your buyers will appreciate on day one.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="text-green-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Fast help for move-in day</h3>
                  <p className="text-sm text-gray-600">
                    We coordinate directly with closing timelines and buyer schedules.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Tag className="text-purple-600" size={28} />
                  </div>
                  <h3 className="font-semibold mb-2">Discount code tied to your name</h3>
                  <p className="text-sm text-gray-600">
                    Track referrals and provide added value with personalized codes.
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

        {/* TESTIMONIALS */}
        <div className="mt-12">
          <Testimonials />
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
