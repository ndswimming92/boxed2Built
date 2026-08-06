import { Head } from 'vite-react-ssg';
import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import TermsOfService from '../components/sections/TermsOfService';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const TermsOfServicePage: React.FC = () => {

  return (
    <>
      <Head>
        <title>{LOCAL_SEO_CONTENT.termsOfService.title}</title>
        <meta name="description" content={LOCAL_SEO_CONTENT.termsOfService.description} />
        <link rel="canonical" href="https://boxed2built.com/terms-of-service" />
        <meta property="og:url" content="https://boxed2built.com/terms-of-service" />
        <meta property="og:title" content="Boxed2Built Terms of Service" />
        <meta property="og:description" content="Review service terms for furniture assembly bookings with Boxed2Built." />
        <meta name="twitter:title" content="Terms of Service | Boxed2Built" />
        <meta name="twitter:description" content="Read the service terms for Boxed2Built appointments and payments." />
      </Head>
      <Header />
      <main className="pt-20">
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto mb-6">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Terms of Service', href: '/terms-of-service', current: true },
                ]}
              />
            </div>
          </div>
        </section>
        <TermsOfService />
        <section className="py-8 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-gray-600 mb-3">
                Ready to book your furniture assembly service?
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <a href="/contact" className="text-blue-700 hover:text-blue-800 font-medium underline">Get a Free Quote</a>
                <span className="text-gray-400">•</span>
                <a href="/services" className="text-blue-700 hover:text-blue-800 font-medium underline">View Our Services</a>
                <span className="text-gray-400">•</span>
                <a href="/privacy-policy" className="text-blue-700 hover:text-blue-800 font-medium underline">Privacy Policy</a>
                <span className="text-gray-400">•</span>
                <a href="/faq" className="text-blue-700 hover:text-blue-800 font-medium underline">FAQ</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default TermsOfServicePage;
