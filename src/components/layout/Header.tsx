import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../utils/analytics';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    trackEvent('mobile-menu-toggle');
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
      trackEvent(`nav-click-${sectionId}`);
    }
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-header');
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-header');
    window.open('https://calendly.com/boxed2built/30min', '_blank');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
      }`}
      ref={menuRef}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <a 
              href="#" 
              className="flex items-center"
              onClick={() => trackEvent('logo-click')}
            >
              <img 
                src="/Modern Minimalist Logo for Boxed2Built.png" 
                alt="Boxed2Built Logo" 
                className="h-12 w-auto"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#about" 
              onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              About
            </a>
            <a 
              href="#services" 
              onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Services
            </a>
            <a 
              href="#booking" 
              onClick={(e) => { e.preventDefault(); scrollToSection('booking'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Book Now
            </a>
          </nav>

          <div className="hidden md:flex items-center">
            <a 
              href="tel:+16154034538" 
              className="flex items-center text-gray-800 hover:text-blue-600 mr-4 transition-colors"
              onClick={handlePhoneClick}
            >
              <Phone size={18} className="mr-2" />
              <span>(615) 403-4538</span>
            </a>
            <Button 
              onClick={handleBookingClick}
              variant="primary"
              trackingLabel="book-consultation-header"
            >
              Book Consultation
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-gray-700 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className={`md:hidden mt-4 pb-4 ${!isScrolled ? 'bg-white shadow-lg rounded-lg' : ''}`}>
            <nav className="flex flex-col space-y-4 p-4">
              <a 
                href="#about" 
                onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                About
              </a>
              <a 
                href="#services" 
                onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Services
              </a>
              <a 
                href="#booking" 
                onClick={(e) => { e.preventDefault(); scrollToSection('booking'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Book Now
              </a>
              <a 
                href="tel:+16154034538" 
                className="flex items-center text-gray-800 hover:text-blue-600 transition-colors"
                onClick={() => trackEvent('phone-click-mobile-menu')}
              >
                <Phone size={18} className="mr-2" />
                <span>(615) 403-4538</span>
              </a>
              <Button 
                onClick={() => {
                  trackEvent('calendly-booking-click-mobile');
                  window.open('https://calendly.com/boxed2built/30min', '_blank');
                }}
                variant="primary"
                className="w-full justify-center"
                trackingLabel="book-consultation-mobile"
              >
                Book Consultation
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;