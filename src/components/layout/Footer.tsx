import React, { useState } from 'react';
import { Facebook, Mail, Phone, Instagram, MapPin } from 'lucide-react';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import TermsOfServiceModal from '../TermsOfServiceModal';
import { trackEvent } from '../../utils/analytics';
import { getCalendlyUrl, getSocialUrl } from '../../utils/utm';

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSocialClick = (platform: string) => {
    trackEvent(`social-click-${platform}`);
  };

  const handlePrivacyClick = () => {
    setShowPrivacy(true);
    trackEvent('privacy-policy-click');
  };

  const handleTermsClick = () => {
    setShowTerms(true);
    trackEvent('terms-of-service-click');
  };

  const handleBookingClick = () => {
    trackEvent('footer-book-now');
    window.open(getCalendlyUrl('footer'), '_blank');
  };

  return (
    <>
      <footer
        className="bg-gray-900 text-white pt-12 pb-6"
        itemScope
        itemType="https://schema.org/LocalBusiness"
      >
        <meta itemProp="name" content="Boxed2Built" />
        <meta itemProp="telephone" content="+19316741196" />
        <meta itemProp="email" content="boxed2builtco@gmail.com" />
        <meta itemProp="url" content="https://www.boxed2built.com" />
        <meta itemProp="priceRange" content="$41-$289" />
        <meta itemProp="paymentAccepted" content="Cash, Credit Card, Debit Card" />

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Company Info */}
            <div className="md:col-span-1">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img
                  src="/Modern Minimalist Logo for Boxed2Built.png"
                  alt="Boxed2Built - Professional Furniture Assembly Service in Spring Hill TN"
                  loading="lazy"
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-gray-400 max-w-md mb-6 text-center md:text-left">
                Professional furniture assembly service in Spring Hill, TN and surrounding Tennessee areas. 
                Expert IKEA, Target, Walmart furniture assembly with flexible scheduling.
              </p>

              <address
                className="not-italic text-sm text-gray-400 text-center md:text-left mb-4"
                itemProp="address"
                itemScope
                itemType="https://schema.org/PostalAddress"
              >
                <div className="flex items-center justify-center md:justify-start mb-2">
                  <MapPin size={16} className="mr-2" />
                  <span>
                    <span itemProp="addressLocality">Spring Hill</span>, <span itemProp="addressRegion">TN</span>
                  </span>
                </div>
                <a href="tel:+16154034538" className="hover:text-white flex items-center justify-center md:justify-start" itemProp="telephone">
                <a href="tel:+19316741196" className="hover:text-white flex items-center justify-center md:justify-start" itemProp="telephone">
                  <Phone size={16} className="mr-2" />
                  (931) 674-1196
                </a>
              </address>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-1">
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="/services" className="hover:text-white transition-colors">Services & Pricing</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Services */}
            <div className="md:col-span-1">
              <h4 className="font-semibold text-white mb-4">Our Services</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>IKEA Furniture Assembly</li>
                <li>Target Furniture Assembly</li>
                <li>Walmart Furniture Assembly</li>
                <li>Bed Frame Assembly</li>
                <li>Dresser Assembly</li>
                <li>Desk & Table Assembly</li>
                <li>Bookshelf Assembly</li>
                <li>Professional Service</li>
              </ul>
            </div>

            {/* Service Areas */}
            <div className="md:col-span-1">
              <h4 className="font-semibold text-white mb-4">Service Areas</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Spring Hill, TN</li>
                <li>Columbia, TN</li>
                <li>Franklin, TN</li>
                <li>Thompson's Station, TN</li>
                <li>Brentwood, TN</li>
                <li>Nashville Metro Area</li>
                <li>Williamson County</li>
                <li>Maury County</li>
              </ul>
            </div>
          </div>

          {/* Social Links and CTA */}
          <div className="border-t border-gray-800 pt-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex space-x-4 justify-center md:justify-start mb-6 md:mb-0">
                <a
                  href={getSocialUrl('facebook', 'https://www.facebook.com/BoxedToBuiltUSA')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('facebook')}
                >
                  <Facebook size={24} title="Facebook" />
                </a>
                <a
                  href={getSocialUrl('instagram', 'https://www.instagram.com/boxed2built/')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Instagram"
                  onClick={() => handleSocialClick('instagram')}
                >
                  <Instagram size={24} title="Instagram" />
                </a>
                <a
                  href="mailto:boxed2builtco@gmail.com?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={24} title="Email" />
                </a>
                <a
                  href="tel:+19316741196"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Phone"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone size={24} title="Phone" />
                </a>
              </div>

              <div className="text-center md:text-right">
                <button
                  onClick={handleBookingClick}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition shadow-lg"
                >
                  Book Free Consultation →
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  By booking, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced service area description */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Professional furniture assembly service proudly serving Spring Hill, Columbia, Franklin, Thompson's Station, 
            Brentwood, and surrounding Tennessee communities. Expert IKEA, Target, Walmart furniture assembly.
          </p>

          <div className="text-sm text-gray-400 text-center space-y-2 mt-4">
            <div>&copy; {currentYear} Boxed2Built. All rights reserved.</div>
            <div>
              <button onClick={handlePrivacyClick} className="underline hover:text-white">
                Privacy Policy
              </button>
              &nbsp;|&nbsp;
              <button onClick={handleTermsClick} className="underline hover:text-white">
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsOfServiceModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};

export default Footer;