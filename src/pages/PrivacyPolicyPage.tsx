import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PrivacyPolicy from '../components/sections/PrivacyPolicy';
import { ChevronRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { LOCAL_SEO_CONTENT } from '../constants/localSEO';

const PrivacyPolicyPage: React.FC = () => {
  usePageMeta({
    title: LOCAL_SEO_CONTENT.privacyPolicy.title,
    description: LOCAL_SEO_CONTENT.privacyPolicy.description,
    canonicalUrl: 'https://boxed2built.com/privacy-policy',
    ogTitle: 'Boxed2Built Privacy Policy',
    ogDescription: 'Read the Boxed2Built privacy policy for furniture assembly services and website usage.',
    twitterTitle: 'Privacy Policy | Boxed2Built',
    twitterDescription: 'Learn how Boxed2Built handles personal information.',
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
              <span className="text-gray-600">Privacy Policy</span>
            </nav>
          </div>
        </section>
        <PrivacyPolicy />
      </main>
      <Footer />
    </>
  );
};

export default PrivacyPolicyPage;
