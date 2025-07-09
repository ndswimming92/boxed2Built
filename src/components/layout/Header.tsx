import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScrolled(window.scrollY > 10);
      }, 100);
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

  const handlePhoneClick = () => {
    trackEvent('phone-click-header');
  };

  const handleNavClick = (page: string) => {
    setIsMenuOpen(false);
    trackEvent(`nav-click-${page}`);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md py-2' : 'bg-white shadow-sm py-4'
      }`}
      ref={menuRef}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <a
              href="/"
              className="flex items-center"
              onClick={() => trackEvent('logo-click')}
              aria-label="Boxed2Built - Home"
            >
              <img
                src="/Modern Minimalist Logo for Boxed2Built.png"
                loading="lazy"
                alt="Boxed2Built - Professional Furniture Assembly"
                title="Boxed2Built - Professional Furniture Assembly"
                className="h-12 w-auto"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center" role="navigation" aria-label="Main navigation">
            <ul className="flex space-x-8">
              <li>
                <a
                  href="/"
                  onClick={() => handleNavClick('home')}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors min-h-[48px]"
                  aria-label="Go to home page"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={() => handleNavClick('about')}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors min-h-[48px]"
                  aria-label="Learn about Boxed2Built"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="/services"
                  onClick={() => handleNavClick('services')}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors min-h-[48px]"
                  aria-label="View our services and pricing"
                >
                  Services
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={() => handleNavClick('contact')}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors min-h-[48px]"
                  aria-label="Contact us for furniture assembly service"
                >
                  Contact
                </a>
              </li>
            </ul>
          </nav>

          <div className="hidden md:flex items-center">
            <a
              href="tel:+16154034538"
              className="flex items-center text-gray-800 hover:text-blue-600 transition-colors"
              onClick={handlePhoneClick}
              aria-label="Call Boxed2Built at (615) 403-4538"
            >
              <Phone size={18} className="mr-2" />
              <span>(615) 403-4538</span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-gray-700 focus:outline-none"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 bg-white shadow-lg rounded-lg">
            <nav className="flex flex-col space-y-4 p-4" role="navigation" aria-label="Mobile navigation">
              <a
                href="/"
                onClick={() => handleNavClick('home')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                aria-label="Go to home page"
              >
                Home
              </a>
              <a
                href="/about"
                onClick={() => handleNavClick('about')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                aria-label="Learn about Boxed2Built"
              >
                About
              </a>
              <a
                href="/services"
                onClick={() => handleNavClick('services')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                aria-label="View our services and pricing"
              >
                Services
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact')}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                aria-label="Contact us for furniture assembly service"
              >
                Contact
              </a>
              <a
                href="tel:+16154034538"
                className="flex items-center text-gray-800 hover:text-blue-600 transition-colors"
                onClick={() => trackEvent('phone-click-mobile-menu')}
                aria-label="Call Boxed2Built at (615) 403-4538"
              >
                <Phone size={18} className="mr-2" />
                <span>(615) 403-4538</span>
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;