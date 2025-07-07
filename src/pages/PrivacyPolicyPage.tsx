import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PrivacyPolicy from '../components/sections/PrivacyPolicy';
import { ChevronRight } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <>
      <Header />
      <main className="pt-20">
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4">
            <nav className="flex items-center mb-6 text-sm max-w-4xl mx-auto">
              <a href="/" className="text-blue-600 hover:text-blue-800">Home</a>
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