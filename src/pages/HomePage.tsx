import React from 'react';
import { useEffect } from 'react';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeCTA from '../components/sections/HomeCTA';
import ContactForm from '../components/ContactForm';
import Footer from '../components/layout/Footer';
import Testimonials from '../components/sections/Testimonials';

const HomePage: React.FC = () => {
  useEffect(() => {
    // Set canonical URL for home page (should remain as root)
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/');
  }, []);

  return (
    <>
      <Header />
      <main>
        <HomeHero />
        <HomeServices />
        
        <Testimonials />
        
        {/* Contact Form Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Request Your Furniture Assembly Service
                </h2>
                <p className="text-xl text-gray-600">
                  Ready to save time and avoid the frustration? Fill out our quick form and we'll get back to you 
                  with details about your furniture assembly project in Spring Hill, TN.
                </p>
              </div>
              
              <ContactForm />
            </div>
          </div>
        </section>
        
        <HomeCTA />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;