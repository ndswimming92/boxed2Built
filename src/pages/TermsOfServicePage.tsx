import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import TermsOfService from '../components/sections/TermsOfService';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const TermsOfServicePage: React.FC = () => {
  usePageMeta({
    title: LOCAL_SEO_CONTENT.termsOfService.title,
    description: LOCAL_SEO_CONTENT.termsOfService.description,
    canonicalUrl: 'https://boxed2built.com/terms-of-service',
    ogTitle: 'Boxed2Built Terms of Service',
    ogDescription: 'Review service terms for furniture assembly bookings with Boxed2Built.',
    twitterTitle: 'Terms of Service | Boxed2Built',
    twitterDescription: 'Read the service terms for Boxed2Built appointments and payments.',
  });

  return (
    <>
      <Header />
      <main className="pt-20">
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4">
            <nav className="flex items-center mb-6 text-sm max-w-4xl mx-auto">
              <a href="/" className="text-blue-700 hover:text-blue-800">Home</a>
              <ChevronRight size={16} className="mx-2 text-gray-400" />
              <span className="text-gray-600">Terms of Service</span>
            </nav>
          </div>
        </section>
        <TermsOfService />
      </main>
      <Footer />
    </>
  );
};

export default TermsOfServicePage;
