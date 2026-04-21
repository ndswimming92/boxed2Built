import React, { useEffect, useRef, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { trackEvent } from '../../utils/analytics';
import ScrollProgressBar from '../ui/ScrollProgressBar';
import CallButton from '../ui/CallButton';
import { useNotificationBarContext } from '../../contexts/NotificationBarContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  const location = useLocation();
  const { isVisible: notificationBarVisible, notificationHeight } =
    useNotificationBarContext();

  /* ----------------------------------------
     Scroll behavior
  ----------------------------------------- */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScrolled(window.scrollY > 10);
      }, 80);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    window.setTimeout(() => {
      firstMobileLinkRef.current?.focus();
    }, 0);
  }, [isMenuOpen]);

  const toggleMenu = () => {
    const nextOpen = !isMenuOpen;
    setIsMenuOpen(nextOpen);

    trackEvent('mobile-menu-toggle', 'header', {
      event_category: 'navigation',
      action_type: nextOpen ? 'open' : 'close',
    });
  };

  const handleNavClick = (page: string, destination: string) => {
    setIsMenuOpen(false);
    trackEvent('navigation_click', 'header', {
      event_category: 'navigation',
      event_label: `nav_${page}`,
      action_type: 'click',
      action_value: destination,
    });
  };

  const handleClientLoginClick = (location: 'desktop' | 'mobile') => {
    setIsMenuOpen(false);
    trackEvent('client_login_nav_click', 'header', {
      event_category: 'navigation',
      event_label: `client_login_${location}`,
      action_type: 'click',
      action_value: '/portal/login',
    });
  };

  const isActivePage = (path: string) => {
    if (path === '/services') {
      return location.pathname === '/services' || location.pathname.startsWith('/services/');
    }
    return location.pathname === path;
  };

  /* ----------------------------------------
     Logo sizing (Option 4 behavior)
  ----------------------------------------- */
  const logoClass = isScrolled
    ? 'h-12 sm:h-14 md:h-16'
    : 'h-16 sm:h-20 md:h-24';

  return (
    <header
      ref={headerRef}
      className={`fixed left-0 right-0 z-50 transition-all duration-300
        ${isScrolled ? 'bg-white/95 py-2 shadow-md' : 'bg-white py-4 shadow-sm'}
      `}
      style={{
        top: notificationBarVisible ? `${notificationHeight}px` : '0',
      }}
    >
      <div className="container mx-auto px-4">
        {/* ----------------------------------------
            Header Row (relative for mobile centering)
        ----------------------------------------- */}
        <div className="relative flex items-center h-20">
          {/* Logo — centered on mobile, left on desktop */}
          <div
            className="
              absolute left-1/2 -translate-x-1/2
              md:static md:translate-x-0
              flex-shrink-0 md:mr-6
            "
          >
            <a
              href="/"
              aria-label="Boxed2Built - Home"
              onClick={() =>
                trackEvent('logo_click', 'header', {
                  event_category: 'navigation',
                  element_type: 'logo',
                })
              }
            >
              <img
                src="/black_boxed2built_logo.png"
                alt="Boxed2Built - Professional Furniture Assembly"
                className={`w-auto object-contain transition-all duration-300 ${logoClass}`}
                width="251"
                height="88"
                fetchpriority="high"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav
            className="hidden md:flex flex-1 justify-center"
            aria-label="Main navigation"
          >
            <ul className="flex items-center gap-6 lg:gap-9">
              {[
                { label: 'Home', href: '/' },
                { label: 'About', href: '/about' },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() =>
                      handleNavClick(item.label.toLowerCase(), item.href)
                    }
                    className={`relative font-medium transition-colors
                      ${
                        isActivePage(item.href)
                          ? 'text-blue-700 font-semibold'
                          : 'text-gray-800 hover:text-blue-700'
                      }
                    `}
                  >
                    {item.label}
                  </a>
                </li>
              ))}

              <li
                className="relative"
                onMouseEnter={() => setIsServicesOpen(true)}
                onMouseLeave={() => setIsServicesOpen(false)}
              >
                <button
                  onClick={() => {
                    window.location.href = '/services';
                    handleNavClick('services', '/services');
                  }}
                  className={`relative font-medium transition-colors flex items-center gap-1
                    ${
                      isActivePage('/services')
                        ? 'text-blue-700 font-semibold'
                        : 'text-gray-800 hover:text-blue-700'
                    }
                  `}
                >
                  Services
                  <ChevronDown className={`w-4 h-4 transition-transform ${isServicesOpen ? 'rotate-180' : ''}`} />
                </button>
                {isServicesOpen && (
                  <div className="absolute top-full left-0 pt-2 z-50">
                    <div className="w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                      <a
                        href="/services"
                        onClick={() => handleNavClick('all_services', '/services')}
                        className="block px-4 py-3 text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <div className="font-semibold">All Services</div>
                        <div className="text-sm text-gray-600">View complete service list</div>
                      </a>
                      <div className="border-t border-gray-200 my-2"></div>
                      <a
                        href="/services/furniture-assembly"
                        onClick={() => handleNavClick('furniture_assembly', '/services/furniture-assembly')}
                        className="block px-4 py-3 text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <div className="font-semibold">Furniture Assembly</div>
                        <div className="text-sm text-gray-600">IKEA, Target, Walmart & more</div>
                      </a>
                      <a
                        href="/services/tv-mounting"
                        onClick={() => handleNavClick('tv_mounting', '/services/tv-mounting')}
                        className="block px-4 py-3 text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <div className="font-semibold">TV Mounting</div>
                        <div className="text-sm text-gray-600">Professional installation & cable management</div>
                      </a>
                    </div>
                  </div>
                )}
              </li>

              {[
                { label: 'Partners', href: '/partners' },
                { label: 'Gallery', href: '/gallery' },
                { label: 'Gift Cards', href: '/gift-cards' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Contact', href: '/contact' },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() =>
                      handleNavClick(item.label.toLowerCase(), item.href)
                    }
                    className={`relative font-medium transition-colors
                      ${
                        isActivePage(item.href)
                          ? 'text-blue-700 font-semibold'
                          : 'text-gray-800 hover:text-blue-700'
                      }
                    `}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right-side desktop actions */}
          <div className="hidden md:flex flex-shrink-0 items-center gap-3">
            <a
              href="/portal/login"
              onClick={() => handleClientLoginClick('desktop')}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Customer Login
            </a>
            <CallButton size="md" pageSection="header" />
          </div>

          {/* Mobile Menu Button — RIGHT SIDE */}
          <button
            ref={mobileMenuButtonRef}
            onClick={toggleMenu}
            className="md:hidden ml-auto p-2 rounded-lg hover:bg-gray-50"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 bg-white rounded-xl shadow-lg border">
            <nav className="flex flex-col p-2">
              {[
                { label: 'Home', href: '/' },
                { label: 'About', href: '/about' },
              ].map((item, index) => (
                <a
                  key={item.href}
                  ref={index === 0 ? firstMobileLinkRef : undefined}
                  href={item.href}
                  onClick={() =>
                    handleNavClick(item.label.toLowerCase(), item.href)
                  }
                  className={`px-4 py-3 rounded-lg font-medium
                    ${
                      isActivePage(item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  {item.label}
                </a>
              ))}

              <div>
                <button
                  onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium
                    ${
                      isActivePage('/services')
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <span>Services</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMobileServicesOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMobileServicesOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    <a
                      href="/services"
                      onClick={() => handleNavClick('all_services', '/services')}
                      className="block px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      All Services
                    </a>
                    <a
                      href="/services/furniture-assembly"
                      onClick={() => handleNavClick('furniture_assembly', '/services/furniture-assembly')}
                      className="block px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Furniture Assembly
                    </a>
                    <a
                      href="/services/tv-mounting"
                      onClick={() => handleNavClick('tv_mounting', '/services/tv-mounting')}
                      className="block px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      TV Mounting
                    </a>
                  </div>
                )}
              </div>

              {[
                { label: 'Partners', href: '/partners' },
                { label: 'Gallery', href: '/gallery' },
                { label: 'Gift Cards', href: '/gift-cards' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Contact', href: '/contact' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() =>
                    handleNavClick(item.label.toLowerCase(), item.href)
                  }
                  className={`px-4 py-3 rounded-lg font-medium
                    ${
                      isActivePage(item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  {item.label}
                </a>
              ))}

              <a
                href="/portal/login"
                onClick={() => handleClientLoginClick('mobile')}
                className="px-4 py-3 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Customer Login
              </a>

              <div className="mt-4 pt-4 border-t">
                <CallButton
                  size="lg"
                  pageSection="header_mobile"
                  fullWidth
                />
              </div>
            </nav>
          </div>
        )}
      </div>

      <ScrollProgressBar />
    </header>
  );
};

export default Header;
