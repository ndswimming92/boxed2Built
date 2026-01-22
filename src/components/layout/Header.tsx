import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { trackEvent } from '../../utils/analytics';
import ScrollProgressBar from '../ui/ScrollProgressBar';
import CallButton from '../ui/CallButton';
import { useNotificationBarContext } from '../../contexts/NotificationBarContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Your original code used menuRef for outside-click detection on the header area.
  // Keep that behavior, but rename for clarity.
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  const location = useLocation();
  const { isVisible: notificationBarVisible, notificationHeight } = useNotificationBarContext();

  // 1) Scroll shadow + compact header (same behavior, slightly smoother + passive listener)
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

  // 2) Close mobile menu on route changes (no other files needed)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // 3) Close menu when clicking outside (same as you had, but uses headerRef)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
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

  // 4) Escape to close + return focus to menu button (better mobile UX/accessibility)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isMenuOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  // 5) When mobile menu opens, focus the first link (nice UX; no other files needed)
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
      element_type: 'button',
      element_location: 'header',
      page_section: 'header',
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
      action_value: destination,
    });
  };

  const isActivePage = (path: string) => location.pathname === path;

  // Desktop nav link styling (tightened spacing a bit; improved underline animation)
  const getNavLinkClasses = (path: string) => {
    const base =
      'relative font-medium transition-colors duration-200 min-h-[44px] flex items-center group px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';
    return isActivePage(path) ? `${base} text-blue-700 font-semibold` : `${base} text-gray-800 hover:text-blue-700`;
  };

  // Mobile nav link styling (kept your look; slightly tighter and clearer)
  const getMobileNavLinkClasses = (path: string) => {
    const base =
      'block font-medium transition-colors duration-200 px-4 py-3 rounded-lg mx-2 my-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';
    return isActivePage(path)
      ? `${base} bg-blue-50 text-blue-700 font-semibold shadow-sm`
      : `${base} text-gray-900 hover:bg-gray-50`;
  };

  // Logo sizing tuned for mobile (your original mobile logo was pretty tall)
  const logoClass = isScrolled ? 'h-10 sm:h-11 md:h-14' : 'h-11 sm:h-12 md:h-16';

  return (
    <header
      ref={headerRef}
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-md py-2' : 'bg-white/98 backdrop-blur-sm shadow-sm py-3'
      }`}
      style={{
        top: notificationBarVisible ? `${notificationHeight}px` : '0',
        boxShadow: isScrolled
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
    >
      <div className="container mx-auto px-4">
        {/* slightly shorter header height for mobile */}
        <div className="relative flex items-center justify-between h-16 sm:h-18 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <a
              href="/"
              className="flex items-center"
              onClick={() =>
                trackEvent('logo_click', 'header', {
                  event_category: 'navigation',
                  element_type: 'logo',
                  element_location: 'header',
                  page_section: 'header',
                  action_type: 'click',
                })
              }
              aria-label="Boxed2Built - Home"
            >
              <img
                src="/black_boxed2built_logo.png"
                loading="lazy"
                alt="Boxed2Built - Professional Furniture Assembly"
                title="Boxed2Built - Professional Furniture Assembly"
                className={`w-auto object-contain transition-all duration-300 ${logoClass}`}
                width="251"
                height="88"
                decoding="async"
                fetchpriority="high"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center flex-1 justify-center" role="navigation" aria-label="Main navigation">
            <ul className="flex items-center gap-6 lg:gap-9">
              {[
                { label: 'Home', href: '/', key: 'home' },
                { label: 'About', href: '/about', key: 'about' },
                { label: 'Services', href: '/services', key: 'services' },
                { label: 'Partners', href: '/partners', key: 'partners' },
                { label: 'Gallery', href: '/gallery', key: 'gallery' },
                { label: 'FAQ', href: '/faq', key: 'faq' },
                { label: 'Contact', href: '/contact', key: 'contact' },
              ].map((item) => (
                <li key={item.key}>
                  <a
                    href={item.href}
                    onClick={() => handleNavClick(item.key, item.href)}
                    className={getNavLinkClasses(item.href)}
                    aria-label={`Go to ${item.label} page`}
                    aria-current={isActivePage(item.href) ? 'page' : undefined}
                  >
                    {item.label}
                    <span
                      className={`absolute bottom-0 left-2 right-2 h-0.5 bg-blue-700 transition-transform duration-200 origin-left ${
                        isActivePage(item.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Call Now Button - Desktop */}
          <div className="hidden md:flex items-center">
            <CallButton size="md" pageSection="header" />
          </div>

          {/* Mobile Menu Button */}
          <button
            ref={mobileMenuButtonRef}
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-800 hover:text-blue-700 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div
            id="mobile-nav"
            className="md:hidden mt-3 pb-4 bg-white shadow-xl rounded-xl border border-gray-200 overflow-hidden"
          >
            <nav className="flex flex-col p-2" role="navigation" aria-label="Mobile navigation">
              <a
                ref={firstMobileLinkRef}
                href="/"
                onClick={() => handleNavClick('home', '/')}
                className={getMobileNavLinkClasses('/')}
                aria-label="Go to home page"
                aria-current={isActivePage('/') ? 'page' : undefined}
              >
                Home
              </a>
              <a
                href="/about"
                onClick={() => handleNavClick('about', '/about')}
                className={getMobileNavLinkClasses('/about')}
                aria-label="Learn about Boxed2Built"
                aria-current={isActivePage('/about') ? 'page' : undefined}
              >
                About
              </a>
              <a
                href="/services"
                onClick={() => handleNavClick('services', '/services')}
                className={getMobileNavLinkClasses('/services')}
                aria-label="View our services and pricing"
                aria-current={isActivePage('/services') ? 'page' : undefined}
              >
                Services
              </a>
              <a
                href="/partners"
                onClick={() => handleNavClick('partners', '/partners')}
                className={getMobileNavLinkClasses('/partners')}
                aria-label="View our partnership programs"
                aria-current={isActivePage('/partners') ? 'page' : undefined}
              >
                Partners
              </a>
              <a
                href="/gallery"
                onClick={() => handleNavClick('gallery', '/gallery')}
                className={getMobileNavLinkClasses('/gallery')}
                aria-label="View our work gallery"
                aria-current={isActivePage('/gallery') ? 'page' : undefined}
              >
                Gallery
              </a>
              <a
                href="/faq"
                onClick={() => handleNavClick('faq', '/faq')}
                className={getMobileNavLinkClasses('/faq')}
                aria-label="View frequently asked questions"
                aria-current={isActivePage('/faq') ? 'page' : undefined}
              >
                FAQ
              </a>
              <a
                href="/contact"
                onClick={() => handleNavClick('contact', '/contact')}
                className={getMobileNavLinkClasses('/contact')}
                aria-label="Contact us for furniture assembly service"
                aria-current={isActivePage('/contact') ? 'page' : undefined}
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
