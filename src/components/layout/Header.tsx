import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

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

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  const getNavLinkClasses = (path: string) => {
    const baseClasses = "relative font-medium transition-all duration-300 min-h-[48px] flex items-center group";
    const isActive = isActivePage(path);
    
    if (isActive) {
      return `${baseClasses} text-blue-600 font-semibold`;
    }
    
    return `${baseClasses} text-gray-700 hover:text-blue-600`;
  };

  const getMobileNavLinkClasses = (path: string) => {
    const baseClasses = "relative font-medium transition-all duration-300 py-2 group";
    const isActive = isActivePage(path);
    
    if (isActive) {
      return `${baseClasses} text-blue-600 font-semibold`;
    }
    
    return `${baseClasses} text-gray-700 hover:text-blue-600`;
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
                  className={getNavLinkClasses('/')}
                  aria-label="Go to home page"
                >
                  Home
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={() => handleNavClick('about')}
                  className={getNavLinkClasses('/about')}
                  aria-label="Learn about Boxed2Built"
                >
                  About
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/services"
                  onClick={() => handleNavClick('services')}
                  className={getNavLinkClasses('/services')}
                  aria-label="View our services and pricing"
                >
                  Services
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={() => handleNavClick('contact')}
                  className={getNavLinkClasses('/contact')}
                  aria-label="Contact us for furniture assembly service"
                >
                  Contact
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Call Now Button - Desktop */}
          <div className="hidden md:flex items-center">
            <a
              href="tel:+16154034538"
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 group"
              onClick={handlePhoneClick}
              aria-label="Call Boxed2Built at (615) 403-4538"
            >
              <Phone size={18} className="mr-2 group-hover:animate-pulse" />
              <span className="hidden lg:inline">Call Now: </span>
              <span>(615) 403-4538</span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-gray-700 hover:text-blue-600 focus:outline-none transition-colors duration-200"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 bg-white shadow-lg rounded-lg border border-gray-100">
            <nav className="flex flex-col space-y-2 p-4" role="navigation" aria-label="Mobile navigation">
              <a
                href="/"
                onClick={() => handleNavClick('home')}
                className={getMobileNavLinkClasses('/')}
                aria-label="Go to home page"
              >
                Home
                {isActivePage('/') && <span className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r"></span>}
              </a>
              <a
                href="/about"
                onClick={() => handleNavClick('about')}
                className={getMobileNavLinkClasses('/about')}
                aria-label="Learn about Boxed2Built"
              >
                About
                {isActivePage('/about') && <span className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r"></span>}
              </a>
              <a
                href="/services"
                onClick={() => handleNavClick('services')}
                className={getMobileNavLinkClasses('/services')}
                aria-label="View our services and pricing"
              >
                Services
                {isActivePage('/services') && <span className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r"></span>}
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact')}
                className={getMobileNavLinkClasses('/contact')}
                aria-label="Contact us for furniture assembly service"
              >
                Contact
                {isActivePage('/contact') && <span className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r"></span>}
              </a>
              
              {/* Call Now Button - Mobile */}
              <div className="pt-4 border-t border-gray-200 mt-4">
                <a
                  href="tel:+16154034538"
                  className="flex items-center justify-center w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group"
                  onClick={() => trackEvent('phone-click-mobile-menu')}
                  aria-label="Call Boxed2Built at (615) 403-4538"
                >
                  <Phone size={18} className="mr-2 group-hover:animate-pulse" />
                  <span>Call Now: (615) 403-4538</span>
                </a>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;