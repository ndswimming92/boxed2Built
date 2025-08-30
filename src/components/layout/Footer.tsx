import React, { useState, useRef } from 'react';
import { Facebook, Mail, Phone, Instagram, MapPin, Star, Youtube } from 'lucide-react';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import TermsOfServiceModal from '../TermsOfServiceModal';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getCalendlyUrl, getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const privacyButtonRef = useRef<HTMLButtonElement>(null);
  const termsButtonRef = useRef<HTMLButtonElement>(null);

  const handleSocialClick = (platform: string) => {
    trackEvent(`social-click-${platform}`, platform, {
      event_category: 'social_media',
      user_engagement: 'social_click'
    });
  };

  const handleReviewClick = () => {
    trackEvent('google-review-click', 'footer', {
      event_category: 'review',
      value: 1,
      user_engagement: 'review_click'
    });
    trackExternalLink(getGoogleReviewUrl(), 'Google Review');
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
                  className="h-12 w-auto object-contain"
                  width="120"
                  height="48"
                  style={{ aspectRatio: '120/48' }}
                  decoding="async"
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
                <a href="tel:+19316741196" className="hover:text-white flex items-center justify-center md:justify-start" itemProp="telephone">
                  <Phone size={16} className="mr-2" />
                  <span className="text-gray-300">(931) 674-1196</span>
                </a>
              </address>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/" className="text-gray-300 hover:text-white transition-colors">Home</a></li>
                <li><a href="/about" className="text-gray-300 hover:text-white transition-colors">About Us</a></li>
                <li><a href="/services" className="text-gray-300 hover:text-white transition-colors">Services & Pricing</a></li>
                <li><a href="/gallery" className="text-gray-300 hover:text-white transition-colors">Gallery</a></li>
                <li><a href="/contact" className="text-gray-300 hover:text-white transition-colors">Contact</a></li>
                <li><a href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms-of-service" className="text-gray-300 hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>

            {/* Services */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Our Services</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="text-gray-300">IKEA Furniture Assembly</li>
                <li className="text-gray-300">Target Furniture Assembly</li>
                <li className="text-gray-300">Walmart Furniture Assembly</li>
                <li className="text-gray-300">Bed Frame Assembly</li>
                <li className="text-gray-300">Dresser Assembly</li>
                <li className="text-gray-300">Desk & Table Assembly</li>
                <li className="text-gray-300">Bookshelf Assembly</li>
                <li className="text-gray-300">Professional Service</li>
              </ul>
            </div>

            {/* Payment Methods */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Payment Methods</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Credit & Debit Cards
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Apple Pay
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 3h-4.9c-1.8 0-3.2.5-4.3 1.5-1.2 1.1-1.8 2.6-1.8 4.5 0 1.6.4 3.4 1.1 5.4l.9 2.6L7.2 21h-4L1 3h4.5l1.2 11.2c.2-1.1.6-2.2 1.1-3.2L12.5 3h7z"/>
                  </svg>
                  Venmo
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Zelle
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" fill="currentColor"/>
                    <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">Z</text>
                  </svg>
                  Contactless Payments
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor"/>
                  </svg>
                  Square
                </li>
                <li className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 15h2c0 1.08 1.37 2 3 2s3-.92 3-2c0-1.1-1.04-1.5-3.24-2.03C9.64 12.44 7 11.78 7 9c0-1.79 1.47-3.31 3.5-3.82V3h3v2.18C15.53 5.69 17 7.21 17 9h-2c0-1.08-1.37-2-3-2s-3 .92-3 2c0 1.1 1.04 1.5 3.24 2.03C14.36 11.56 17 12.22 17 15c0 1.79-1.47 3.31-3.5 3.82V21h-3v-2.18C8.47 18.31 7 16.79 7 15z"/>
                  </svg>
                  Cash
                </li>
              </ul>
              <p className="text-xs text-gray-400 mt-3 italic">
                Payment due upon completion
              </p>
            </div>

            {/* Service Areas */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Service Areas</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="text-gray-300">Spring Hill, TN</li>
                <li className="text-gray-300">Columbia, TN</li>
                <li className="text-gray-300">Franklin, TN</li>
                <li className="text-gray-300">Thompson's Station, TN</li>
                <li className="text-gray-300">Brentwood, TN</li>
                <li className="text-gray-300">Nashville Metro Area</li>
                <li className="text-gray-300">Williamson County</li>
                <li className="text-gray-300">Maury County</li>
              </ul>
            </div>
          </div>

          {/* Social Links and CTA */}
          <div className="border-t border-gray-800 pt-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex flex-col items-center md:items-start gap-4 mb-6 md:mb-0">
                {/* Social Media Icons */}
                <div className="flex space-x-4 justify-center md:justify-start">
                <a
                  href={getSocialUrl('facebook', 'https://www.facebook.com/BoxedToBuiltUSA')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('facebook')}
                >
                  <Facebook size={24} title="Facebook" />
                </a>
                <a
                  href={getSocialUrl('instagram', 'https://www.instagram.com/boxed2built/')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Instagram"
                  onClick={() => handleSocialClick('instagram')}
                >
                  <Instagram size={24} title="Instagram" />
                </a>
                <a
                  href={getSocialUrl('youtube', 'https://www.youtube.com/@Boxed2BuiltUSA')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="YouTube"
                  onClick={() => handleSocialClick('youtube')}
                >
                  <Youtube size={24} title="YouTube" />
                </a>
                <a
                  href="mailto:boxed2builtco@gmail.com?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={24} title="Email" />
                </a>
                <a
                  href="tel:+19316741196" 
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Phone"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone size={24} title="Phone" />
                </a>
                </div>

                {/* Google Review Button */}
                <a
                  href={getGoogleReviewUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                  aria-label="Leave a Google Review"
                  onClick={handleReviewClick}
                >
                  <Star size={16} className="fill-current mr-2" />
                  Leave us a Review!
                </a>
              </div>

              <div className="text-center md:text-right">
                <button
                  onClick={handleBookingClick}
                  className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition shadow-lg"
                >
                  Book Free Consultation →
                </button>
                <p className="text-xs text-gray-300 mt-2">
                  By booking, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced service area description */}
          <p className="text-xs text-gray-300 text-center mt-4">
            Professional furniture assembly service proudly serving Spring Hill, Columbia, Franklin, Thompson's Station, 
            Brentwood, and surrounding Tennessee communities. Expert IKEA, Target, Walmart furniture assembly. View all{' '}
            <a href="/services" className="text-blue-200 hover:text-white underline">
              our services and areas
            </a>.
          </p>

          <div className="text-sm text-gray-300 text-center space-y-2 mt-4">
            <div>&copy; {currentYear} Boxed2Built. All rights reserved.</div>
            <div>
              <button 
                ref={privacyButtonRef}
                onClick={handlePrivacyClick} 
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
              >
                Privacy Policy
              </button>
              &nbsp;|&nbsp;
              <button 
                ref={termsButtonRef}
                onClick={handleTermsClick} 
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PrivacyPolicyModal 
        isOpen={showPrivacy} 
        onClose={() => setShowPrivacy(false)} 
        triggerRef={privacyButtonRef}
      />
      <TermsOfServiceModal 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        triggerRef={termsButtonRef}
      />
    </>
  );
};

export default Footer;