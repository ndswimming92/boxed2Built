import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PrivacyPolicy from '../components/sections/PrivacyPolicy';
import Breadcrumbs from '../components/ui/Breadcrumbs';
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
            <div className="max-w-4xl mx-auto mb-6">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Privacy Policy', href: '/privacy-policy', current: true },
                ]}
              />
            </div>
          </div>
        </section>
        <PrivacyPolicy />
        <section className="py-8 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-gray-600 mb-3">
                Questions about our privacy practices? We're happy to help.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <a href="/contact" className="text-blue-700 hover:text-blue-800 font-medium underline">Contact Us</a>
                <span className="text-gray-400">•</span>
                <a href="/terms-of-service" className="text-blue-700 hover:text-blue-800 font-medium underline">Terms of Service</a>
                <span className="text-gray-400">•</span>
                <a href="/services" className="text-blue-700 hover:text-blue-800 font-medium underline">Our Services</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default PrivacyPolicyPage;
