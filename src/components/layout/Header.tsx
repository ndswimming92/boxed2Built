import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import { trackEvent } from '../../utils/analytics';
import { useLocation } from 'react-router-dom';
import ScrollProgressBar from '../ui/ScrollProgressBar';
import CallButton from '../ui/CallButton';
import { BUSINESS_INFO, ADDRESS_INFO, SERVICE_AREAS } from '../../constants/localSEO';
import { useNotificationBarContext } from '../../contexts/NotificationBarContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { isVisible: notificationBarVisible, notificationHeight } = useNotificationBarContext();

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
    trackEvent('mobile-menu-toggle', 'header', {
      event_category: 'navigation',
      action_type: isMenuOpen ? 'close' : 'open',
      element_type: 'button',
      element_location: 'header',
      page_section: 'header'
    });
  };


  const handleNavClick = (page: string, destination: string) => {
    setIsMenuOpen(false);
    trackEvent('navigation_click', 'header', {
      event_category: 'navigation',
      event_label: `nav_${page}`,
      user_engagement: 'navigation_click',
      element_type: 'link',
      element_location: 'header',
      page_section: 'header',
      action_type: 'click',
      action_value: destination
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
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-lg py-2' : 'bg-white/98 backdrop-blur-sm shadow-sm py-3'
      }`}
      ref={menuRef}
      style={{
        top: notificationBarVisible ? `${notificationHeight}px` : '0',
        boxShadow: isScrolled
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}
    >
      <div className="container mx-auto px-4">
        <div className="relative flex justify-center md:justify-between items-center h-20 md:h-24">
          <div className="flex items-center md:mr-6">
            <a
              href="/"
              className="flex items-center"
              onClick={() => trackEvent('logo_click', 'header', {
                event_category: 'navigation',
                element_type: 'logo',
                element_location: 'header',
                page_section: 'header',
                action_type: 'click'
              })}
              aria-label="Boxed2Built - Home"
            >
              <img
                src="/black_boxed2built_logo.png"
                loading="lazy"
                alt="Boxed2Built - Professional Furniture Assembly"
                title="Boxed2Built - Professional Furniture Assembly"
                className={`w-auto object-contain transition-all duration-300 ${
                  isScrolled ? 'h-14 md:h-18' : 'h-16 md:h-20'
                }`}
                width="251"
                height="88"
                style={{ aspectRatio: '160/56' }}
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
                  onClick={() => handleNavClick('home', '/')}
                  className={`${getNavLinkClasses('/')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Go to home page"
                  aria-current={isActivePage('/') ? 'page' : undefined}
                >
                  Home
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={() => handleNavClick('about', '/about')}
                  className={`${getNavLinkClasses('/about')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Learn about Boxed2Built"
                  aria-current={isActivePage('/about') ? 'page' : undefined}
                >
                  About
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/about') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/services"
                  onClick={() => handleNavClick('services', '/services')}
                  className={`${getNavLinkClasses('/services')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our services and pricing"
                  aria-current={isActivePage('/services') ? 'page' : undefined}
                >
                  Services
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/services') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/partners"
                  onClick={() => handleNavClick('partners', '/partners')}
                  className={`${getNavLinkClasses('/partners')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our partnership programs"
                  aria-current={isActivePage('/partners') ? 'page' : undefined}
                >
                  Partners
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/partners') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/gallery"
                  onClick={() => handleNavClick('gallery', '/gallery')}
                  className={`${getNavLinkClasses('/gallery')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View our work gallery"
                  aria-current={isActivePage('/gallery') ? 'page' : undefined}
                >
                  Gallery
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/gallery') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/faq"
                  onClick={() => handleNavClick('faq', '/faq')}
                  className={`${getNavLinkClasses('/faq')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="View frequently asked questions"
                  aria-current={isActivePage('/faq') ? 'page' : undefined}
                >
                  FAQ
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/faq') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={() => handleNavClick('contact', '/contact')}
                  className={`${getNavLinkClasses('/contact')} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md px-2 py-1`}
                  aria-label="Contact us for furniture assembly service"
                  aria-current={isActivePage('/contact') ? 'page' : undefined}
                >
                  Contact
                  <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-700 transition-all duration-300 ${
                    isActivePage('/contact') ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Call Now Button - Desktop */}
          <div className="hidden md:flex items-center ml-8">
            <CallButton size="md" pageSection="header" />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="absolute right-0 md:hidden text-gray-800 hover:text-blue-700 focus:outline-none transition-colors duration-200"
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
                onClick={() => handleNavClick('home', '/')}
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
                onClick={() => handleNavClick('about', '/about')}
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
                onClick={() => handleNavClick('services', '/services')}
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
                onClick={() => handleNavClick('partners', '/partners')}
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
                onClick={() => handleNavClick('gallery', '/gallery')}
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
                href="/faq"
                onClick={() => handleNavClick('faq', '/faq')}
                className={`${getMobileNavLinkClasses('/faq')} px-4 py-3 rounded-lg mx-2 my-1 transition-all duration-200 ${
                  isActivePage('/faq')
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                    : 'hover:bg-gray-50'
                }`}
                aria-label="View frequently asked questions"
              >
                FAQ
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact', '/contact')}
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
                <CallButton size="lg" pageSection="header_mobile_menu" fullWidth={true} className="rounded-xl py-3.5" />
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