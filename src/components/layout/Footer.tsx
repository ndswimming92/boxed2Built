import React, { useState } from 'react';
import { Facebook, Mail, Phone, Instagram, Star } from 'lucide-react';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import TermsOfServiceModal from '../TermsOfServiceModal';
import { trackEvent } from '../../utils/analytics';

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

  return (
    <>
      <footer
        className="bg-gray-900 text-white pt-12 pb-6"
        itemScope
        itemType="https://schema.org/LocalBusiness"
      >
        <meta itemProp="name" content="Boxed2Built" />
        <meta itemProp="telephone" content="+16154034538" />
        <meta itemProp="email" content="boxed2builtco@gmail.com" />
        <meta itemProp="url" content="https://www.boxed2built.com" />

        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between mb-8">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img
                  src="/Modern Minimalist Logo for Boxed2Built.png"
                  alt="Boxed2Built company logo"
                  loading="lazy"
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-gray-400 max-w-md mb-6 text-center md:text-left">
                Professional furniture assembly in Spring Hill, TN and surrounding areas. From box to built, we make home setup quick, easy, and stress-free.
              </p>

              <address
                className="not-italic text-sm text-gray-400 text-center md:text-left mb-4"
                itemProp="address"
                itemScope
                itemType="https://schema.org/PostalAddress"
              >
                <span itemProp="addressLocality">Spring Hill</span>, <span itemProp="addressRegion">TN</span><br />
                <a href="tel:+16154034538" className="hover:text-white" itemProp="telephone">
                  +1 (615) 403-4538
                </a>
              </address>

              {/* ⭐ Google Review Link with Icon */}
              <div className="text-sm text-center md:text-left mt-2">
                <a
                  href="https://g.page/r/CW-qaf93r1ZuEAI/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center underline text-gray-400 hover:text-white transition"
                  onClick={() => trackEvent('footer-google-review-click')}
                >
                  <Star size={18} className="text-yellow-400 mr-1 drop-shadow-sm" />
                  Leave us a Google review
                </a>
              </div>

              <div className="flex space-x-4 justify-center md:justify-start mt-4">
                <a
                  href="https://www.facebook.com/BoxedToBuiltUSA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('facebook')}
                >
                  <Facebook size={24} title="Facebook" />
                </a>
                <a
                  href="https://www.instagram.com/boxed2built/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Instagram"
                  onClick={() => handleSocialClick('instagram')}
                >
                  <Instagram size={24} title="Instagram" />
                </a>
                <a
                  href="mailto:boxed2builtco@gmail.com"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={24} title="Email" />
                </a>
                <a
                  href="tel:+16154034538"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Phone"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone size={24} title="Phone" />
                </a>
              </div>

              <div className="text-center md:text-left mt-6">
                <a
                  href="https://calendly.com/boxed2built/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-gray-900 font-semibold py-2 px-4 rounded hover:bg-gray-200 transition"
                  onClick={() => trackEvent('footer-book-now')}
                >
                  Book a Free Appointment →
                </a>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Proudly serving Spring Hill, Franklin, Columbia, and nearby Tennessee communities with expert furniture assembly.
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
