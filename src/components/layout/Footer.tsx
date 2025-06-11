import React, { useState } from 'react';
import { Facebook, Mail, Phone } from 'lucide-react';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import TermsOfServiceModal from '../TermsOfServiceModal';
import { trackEvent } from '../../utils/analytics';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
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
      <footer className="bg-gray-900 text-white pt-12 pb-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between mb-8">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img 
                  src="/Modern Minimalist Logo for Boxed2Built.png" 
                  alt="Boxed2Built Logo" 
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-gray-400 max-w-md mb-6 text-center md:text-left">
                Professional furniture assembly in Spring Hill, TN and surrounding areas. From box to built, we make home setup quick, easy, and stress-free.
              </p>
              <div className="flex space-x-4 justify-center md:justify-start">
                <a 
                  href="https://www.facebook.com/profile.php?id=6154034538" 
                  className="text-gray-400 hover:text-white" 
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('facebook')}
                >
                  <Facebook />
                </a>
                <a 
                  href="mailto:boxed2builtco@gmail.com" 
                  className="text-gray-400 hover:text-white" 
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail />
                </a>
                <a 
                  href="tel:+16154034538" 
                  className="text-gray-400 hover:text-white" 
                  aria-label="Phone"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone />
                </a>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400 text-center space-y-2">
            <div>
              &copy; {currentYear} Boxed2Built. All rights reserved.
            </div>
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