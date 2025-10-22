import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { useLocation } from 'react-router-dom';
import ScrollProgressBar from '../ui/ScrollProgressBar';
import { BUSINESS_INFO, ADDRESS_INFO, SERVICE_AREAS } from '../../constants/localSEO';

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
    trackEvent('phone-click-header', 'header', {
      event_category: 'contact',
      value: 1,
      user_engagement: 'phone_click'
    });
    trackExternalLink('tel:+16154034538', 'Header Phone');
  };

  const handleNavClick = (page: string) => {
    setIsMenuOpen(false);
    trackEvent(`nav-click-${page}`, page, {
      event_category: 'navigation',
      user_engagement: 'navigation_click'
    });
  };

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  const napData = {
    businessName: BUSINESS_INFO.name,
    phone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    address: ADDRESS_INFO,
    serviceAreas: SERVICE_AREAS,
    website: BUSINESS_INFO.website
  };

  const getNavLinkClasses = (path: string) => {
    const baseClasses = "relative font-medium transition-all duration-300 min-h-[48px] flex items-center group";
    const isActive = isActivePage(path);
    
    if (isActive) {
      return `${baseClasses} text-blue-700 font-semibold`;
    }
    
    return `${baseClasses} text-gray-800 hover:text-blue-700`;
  };

  const getMobileNavLinkClasses = (path: string) => {
    const baseClasses = "block font-medium transition-all duration-200";
    const isActive = isActivePage(path);
    
    if (isActive) {
      return `${baseClasses}`;
    }
    
    return `${baseClasses} text-gray-800`;
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
                className="h-12 w-auto object-contain"
                width="120"
                height="48"
                style={{ aspectRatio: '120/48' }}
                decoding="async"
                fetchpriority="high"
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
                  className={`${getNavLinkClasses('/')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Go to home page"
                >
                  Home
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={() => handleNavClick('about')}
                  className={`${getNavLinkClasses('/about')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Learn about Boxed2Built"
                >
                  About
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/services"
                  onClick={() => handleNavClick('services')}
                  className={`${getNavLinkClasses('/services')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our services and pricing"
                >
                  Services
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/partners"
                  onClick={() => handleNavClick('partners')}
                  className={`${getNavLinkClasses('/partners')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our partnership programs"
                >
                  Partners
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/gallery"
                  onClick={() => handleNavClick('gallery')}
                  className={`${getNavLinkClasses('/gallery')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our work gallery"
                >
                  Gallery
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={() => handleNavClick('contact')}
                  className={`${getNavLinkClasses('/contact')} focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Contact us for furniture assembly service"
                >
                  Contact
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-700 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Call Now Button - Desktop */}
          <div className="hidden md:flex items-center ml-8">
            <a
              href="tel:+16154034538"
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group"
              onClick={handlePhoneClick}
              aria-label="Call Boxed2Built at (615) 403-4538"
              itemProp="telephone"
            >
              <Phone size={18} className="mr-2 group-hover:animate-pulse" />
              <span className="font-bold text-white">{BUSINESS_INFO.phoneFormatted}</span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-gray-800 hover:text-blue-700 focus:outline-none transition-colors duration-200"
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
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
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
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
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
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="View our services and pricing"
              >
                Services
              </a>
              <a
                href="/partners"
                onClick={() => handleNavClick('partners')}
                className={`${getMobileNavLinkClasses('/partners')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/partners') 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="View our partnership programs"
              >
                Partners
              </a>
              <a
                href="/gallery"
                onClick={() => handleNavClick('gallery')}
                className={`${getMobileNavLinkClasses('/gallery')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/gallery') 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="View our work gallery"
              >
                Gallery
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact')}
                className={`${getMobileNavLinkClasses('/contact')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/contact') 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                    : 'hover:bg-gray-50'
                }`}
                aria-label="Contact us for furniture assembly service"
              >
                Contact
              </a>
              
              {/* Call Now Button - Mobile */}
              <div className="pt-4 border-t border-gray-200 mt-4 mx-2">
                <a
                  href="tel:+16154034538"
                  className="flex items-center justify-center w-full px-4 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 group"
                  onClick={() => trackEvent('phone-click-mobile-menu')}
                  aria-label="Call Boxed2Built at (615) 403-4538"
                  itemProp="telephone"
                >
                  <Phone size={20} className="mr-2 group-hover:animate-pulse" />
                  <span className="font-bold text-white">{BUSINESS_INFO.phoneFormatted}</span>
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