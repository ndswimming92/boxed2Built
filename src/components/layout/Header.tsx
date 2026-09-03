import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck, Menu, X, ChevronDown, ShoppingBag, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLocation } from 'react-router-dom';

import { trackEvent } from '../../utils/analytics';
import ScrollProgressBar from '../ui/ScrollProgressBar';
import { useNotificationBarContext } from '../../contexts/NotificationBarContext';
import { SERVICE_LANDING_PAGES } from '../../constants/serviceLandingPages';
import { useCartOptional } from '../../contexts/CartContext';
import { useBookingEnabled } from '../../hooks/useBookingPublicInfo';

const SERVICE_MENU_ITEMS = [
  {
    href: '/services/furniture-assembly',
    label: 'Furniture Assembly',
    description: 'IKEA, Target, Walmart & more',
    trackingId: 'furniture_assembly',
  },
  {
    href: '/services/tv-mounting',
    label: 'TV Mounting',
    description: 'Professional installation & cable management',
    trackingId: 'tv_mounting',
  },
  ...SERVICE_LANDING_PAGES.map((page) => ({
    href: `/services/${page.slug}`,
    label: page.navLabel,
    description: page.navDescription,
    trackingId: page.slug.replace(/-/g, '_'),
  })),
];

/* Desktop nav items share one treatment. The padding is what separates the
   labels now (they used to sit almost shoulder to shoulder) and it doubles as
   a bigger hit target, while an underline sweeps out from the centre on hover
   so the link reads as interactive. Weight never changes on hover, so nothing
   nudges its neighbours sideways. */
const DESKTOP_NAV_ITEM_BASE = [
  'relative inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2',
  'text-sm font-medium transition-colors duration-200 2xl:px-4 2xl:text-base',
  "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-blue-700 after:content-['']",
  'after:origin-center after:transition-transform after:duration-300 after:ease-out 2xl:after:inset-x-4',
  'motion-reduce:after:transition-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
].join(' ');

/* `open` keeps the Services trigger lit while its dropdown is showing, since
   the pointer moves off the button and onto the panel. */
const desktopNavItemClass = (active: boolean, open = false) =>
  [
    DESKTOP_NAV_ITEM_BASE,
    active || open ? 'text-blue-700' : 'text-gray-800 hover:text-blue-700',
    active ? 'font-semibold' : '',
    active || open
      ? 'after:scale-x-100'
      : 'after:scale-x-0 hover:after:scale-x-100',
  ].join(' ');

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);

  // Hidden until the policy says booking is open, so the button never points
  // at a page that will turn the visitor away.
  const bookingEnabled = useBookingEnabled();

  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  const location = useLocation();
  const { isVisible: notificationBarVisible, notificationHeight } =
    useNotificationBarContext();
  // Null on admin/portal routes, which render outside the cart provider.
  const cart = useCartOptional();
  const cartCount = cart?.itemCount ?? 0;

  const [hasStoreProducts, setHasStoreProducts] = useState(false);

  useEffect(() => {
    let canceled = false;
    supabase
      .from('shop_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => {
        if (!canceled) setHasStoreProducts((count ?? 0) > 0);
      });
    return () => { canceled = true; };
  }, []);

  const openCart = () => {
    cart?.openCart();
    setIsMenuOpen(false);
    trackEvent('cart_open', 'header', {
      event_category: 'ecommerce',
      action_type: 'open_cart',
      action_value: String(cartCount),
    });
  };

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

  /* Publish the bottom edge of the fixed header stack (notification bar +
     header bar) as a CSS variable so sticky elements elsewhere (e.g. the quote
     form's progress bar/rail) can pin just below it without hardcoding the
     offset. Header bar height is deterministic: h-20 row (80px) + py-2/py-4. */
  useEffect(() => {
    const headerBarHeight = isScrolled ? 96 : 112;
    const offset = (notificationBarVisible ? notificationHeight : 0) + headerBarHeight;
    document.documentElement.style.setProperty('--app-header-bottom', `${offset}px`);
  }, [isScrolled, notificationBarVisible, notificationHeight]);

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


  const isActivePage = (path: string) => {
    if (path === '/services' || path === '/service-areas') {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
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
              xl:static xl:translate-x-0
              flex-shrink-0 xl:mr-4 2xl:mr-6
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
                src="/boxed2built_logo.svg"
                alt="Boxed2Built - Professional Furniture Assembly"
                className={`w-auto object-contain transition-all duration-300 ${logoClass}`}
                width="88"
                height="88"
                fetchPriority="high"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav
            className="hidden xl:flex flex-1 justify-center min-w-0"
            aria-label="Main navigation"
          >
            <ul className="flex items-center gap-1 2xl:gap-2">
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
                    className={desktopNavItemClass(isActivePage(item.href))}
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
                  className={`${desktopNavItemClass(isActivePage('/services'), isServicesOpen)} gap-1.5`}
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
                      {SERVICE_MENU_ITEMS.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={() => handleNavClick(item.trackingId, item.href)}
                          className="block px-4 py-3 text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-sm text-gray-600">{item.description}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </li>

              {[
                { label: 'Service Areas', href: '/service-areas' },
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
                    className={desktopNavItemClass(isActivePage(item.href))}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right-side desktop actions */}
          {(hasStoreProducts || bookingEnabled) && (
          <div className="hidden xl:flex flex-shrink-0 items-center gap-2 2xl:gap-3">
            {/* The nav had no call to action at all, so booking takes the slot
                rather than competing with one. Quoting stays the default path
                for anyone who does not yet know what they need. */}
            {bookingEnabled && (
              <a
                href="/book"
                onClick={() => handleNavClick('book', '/book')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-lg 2xl:gap-2 2xl:px-4 2xl:text-base ${
                  isActivePage('/book')
                    ? 'bg-emerald-800 text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                aria-label="Book a time"
              >
                <CalendarCheck size={17} />
                <span>Book Now</span>
              </a>
            )}

            {hasStoreProducts && cartCount > 0 && (
              <button
                onClick={openCart}
                className="relative inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                aria-label={`View cart — ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              >
                <ShoppingCart size={17} />
                <span>Cart</span>
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-700 px-1 text-xs font-bold text-white">
                  {cartCount}
                </span>
              </button>
            )}

            {hasStoreProducts && (
            <a
              href="/store"
              onClick={() => handleNavClick('store', '/store')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-lg 2xl:gap-2 2xl:px-4 2xl:text-base ${
                isActivePage('/store')
                  ? 'bg-blue-800 text-white'
                  : 'bg-blue-700 text-white hover:bg-blue-800'
              }`}
              aria-label="Shop 3D printed items"
            >
              <ShoppingBag size={17} />
              <span>Store</span>
            </a>
            )}
          </div>
          )}

          {/* Mobile actions — RIGHT SIDE */}
          <div className="xl:hidden ml-auto flex items-center gap-1">
            {hasStoreProducts && cartCount > 0 && (
              <button
                onClick={openCart}
                className="relative p-2 rounded-lg text-blue-700 hover:bg-blue-50"
                aria-label={`View cart — ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              >
                <ShoppingCart size={22} />
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-700 px-1 text-xs font-bold text-white">
                  {cartCount}
                </span>
              </button>
            )}

            <button
              ref={mobileMenuButtonRef}
              onClick={toggleMenu}
              className="p-2 rounded-lg hover:bg-gray-50"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="xl:hidden mt-4 bg-white rounded-xl shadow-lg border">
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
                    {SERVICE_MENU_ITEMS.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => handleNavClick(item.trackingId, item.href)}
                        className="block px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {[
                { label: 'Service Areas', href: '/service-areas' },
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

              {bookingEnabled && (
                <div className="mt-4 pt-4 border-t">
                  <a
                    href="/book"
                    onClick={() => handleNavClick('book', '/book')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-emerald-700"
                  >
                    <CalendarCheck size={20} />
                    <span>Book Now</span>
                  </a>
                </div>
              )}

              {hasStoreProducts && (
              <div className="mt-4 pt-4 border-t space-y-3">
                {cartCount > 0 && (
                  <button
                    onClick={openCart}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-700 bg-white px-6 py-3 text-lg font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                  >
                    <ShoppingCart size={20} />
                    <span>View cart</span>
                    <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blue-700 px-1.5 text-sm font-bold text-white">
                      {cartCount}
                    </span>
                  </button>
                )}

                <a
                  href="/store"
                  onClick={() => handleNavClick('store', '/store')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-blue-800"
                >
                  <ShoppingBag size={20} />
                  <span>Store</span>
                </a>
              </div>
              )}
            </nav>
          </div>
        )}
      </div>

      <ScrollProgressBar />
    </header>
  );
};

export default Header;
