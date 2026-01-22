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

  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  const location = useLocation();
  const { isVisible: notificationBarVisible, notificationHeight } =
    useNotificationBarContext();

  /* ----------------------------------------
     Scroll behavior (shrink header on scroll)
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
    const handleClickOutside = (event: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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

  const isActivePage = (path: string) => location.pathname === path;

  /* ----------------------------------------
     LOGO SIZING (Option 4)
     Big on load, compact on scroll
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
            OPTION 2: Logo-first layout
        ----------------------------------------- */}
        <div className="relative flex items-center h-20">
          {/* Logo (never shrinks) */}
          <div className="flex-shrink-0 mr-6">
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

          {/* Desktop Navigation (flexes around logo) */}
          <nav
            className="hidden md:flex flex-1 justify-center"
            aria-label="Main navigation"
          >
            <ul className="flex items-center gap-6 lg:gap-9">
              {[
                { label: 'Home', href: '/' },
                { label: 'About', href: '/about' },
                { label: 'Services', href: '/services' },
                { label: 'Partners', href: '/partners' },
                { label: 'Gallery', href: '/gallery' },
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

          {/* Call Button */}
          <div className="hidden md:flex flex-shrink-0">
            <CallButton size="md" pageSection="header" />
          </div>

          {/* Mobile Menu Button */}
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
                { label: 'Services', href: '/services' },
                { label: 'Partners', href: '/partners' },
                { label: 'Gallery', href: '/gallery' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Contact', href: '/contact' },
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
