import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { useLocation } from 'react-router-dom';
import ScrollProgressBar from '../ui/ScrollProgressBar';

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
    const baseClasses = "block font-medium transition-all duration-200";
    const isActive = isActivePage(path);
    
    if (isActive) {
      return `${baseClasses}`;
    }
    
    return `${baseClasses} text-gray-700`;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-lg py-2' : 'bg-white/98 backdrop-blur-sm shadow-sm py-4'
      }`}
      ref={menuRef}
      style={{
        boxShadow: isScrolled 
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center mr-6">
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
                width="120"
                height="48"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center flex-1 justify-center" role="navigation" aria-label="Main navigation">
            <ul className="flex space-x-10">
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
          <div className="hidden md:flex items-center ml-8">
            <a
              href="tel:+19316741196"
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 group"
              onClick={handlePhoneClick}
              aria-label="Call Boxed2Built at (931) 674-1196"
            >
              <Phone size={18} className="mr-2 group-hover:animate-pulse" />
              <span>Call Now</span>
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
          <div className="md:hidden mt-4 pb-4 bg-white shadow-xl rounded-xl border border-gray-200 overflow-hidden">
            <nav className="flex flex-col p-2" role="navigation" aria-label="Mobile navigation">
              <a
                href="/"
                onClick={() => handleNavClick('home')}
                className={`${getMobileNavLinkClasses('/')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/') 
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="Go to home page"
              >
                Home
              </a>
              <a
                href="/about"
                onClick={() => handleNavClick('about')}
                className={`${getMobileNavLinkClasses('/about')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/about') 
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="Learn about Boxed2Built"
              >
                About
              </a>
              <a
                href="/services"
                onClick={() => handleNavClick('services')}
                className={`${getMobileNavLinkClasses('/services')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/services') 
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="View our services and pricing"
              >
                Services
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact')}
                className={`${getMobileNavLinkClasses('/contact')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/contact') 
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="Contact us for furniture assembly service"
              >
                Contact
              </a>
              
              {/* Call Now Button - Mobile */}
              <div className="pt-4 border-t border-gray-200 mt-4 mx-2">
                <a
                  href="tel:+19316741196"
                  className="flex items-center justify-center w-full px-4 py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 group"
                  onClick={() => trackEvent('phone-click-mobile-menu')}
                  aria-label="Call Boxed2Built at (931) 674-1196"
                >
                  <Phone size={20} className="mr-2 group-hover:animate-pulse" />
                  <span>Call Now</span>
                </a>
              </div>
            </nav>
          </div>
        )}
      </div>
      
      {/* Scroll Progress Bar */}
      <ScrollProgressBar />
    </header>
  );
};

export default Header;