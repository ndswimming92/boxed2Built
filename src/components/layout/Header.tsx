import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, Menu, X, ChevronDown, ChevronRight, Phone, ShoppingBag, ShoppingCart } from 'lucide-react';
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

/* Mobile menu: a full-screen navy sheet in the hero's navy and the logo's
   gold. The five pages people look for most get large slab-serif links; the
   rest sit in a quieter grid of tiles below, and the calls to action are
   pinned to the end of the list. */
const MOBILE_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]';

const MOBILE_PRIMARY_LINKS = [
  { label: 'Service Areas', href: '/service-areas' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Deals & News', href: '/news', badge: 'Sales' },
];

const MOBILE_SECONDARY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Partners', href: '/partners' },
  { label: 'Gift Cards', href: '/gift-cards' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

const mobilePrimaryClass = (active: boolean) =>
  [
    'flex min-h-[56px] w-full items-center gap-3 rounded-md text-left font-display text-[26px] font-bold leading-tight transition-colors',
    MOBILE_FOCUS_RING,
    active ? 'text-[#D9A441]' : 'text-[#F5EFE3] hover:text-[#D9A441]',
  ].join(' ');

const mobileTileClass = (active: boolean) =>
  [
    'flex min-h-[46px] items-center justify-between rounded-xl border pl-3.5 pr-3 text-[15px] font-medium',
    'shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-colors',
    MOBILE_FOCUS_RING,
    active
      ? 'border-[#D9A441]/70 bg-[#D9A441]/10 text-[#D9A441]'
      : 'border-[#F5EFE3]/[0.12] bg-[#F5EFE3]/[0.05] text-[#E6E9F0] hover:bg-[#F5EFE3]/10',
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
  const [headerActionsReady, setHeaderActionsReady] = useState(false);

  useEffect(() => {
    let canceled = false;
    supabase
      .from('shop_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => {
        if (!canceled) {
          setHasStoreProducts((count ?? 0) > 0);
          setHeaderActionsReady(true);
        }
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

  /* While the full-screen menu is open the page behind it must not scroll,
     Escape closes it, and closing hands focus back to the hamburger. */
  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const hamburger = mobileMenuButtonRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      hamburger?.focus({ preventScroll: true });
    };
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
                { label: 'Deals & News', href: '/news' },
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
          <div className={`hidden xl:flex flex-shrink-0 items-center gap-2 2xl:gap-3 transition-opacity duration-200 ${headerActionsReady && (hasStoreProducts || bookingEnabled) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                  ? 'bg-brand-gold-cta-hover text-brand-navy-deep'
                  : 'bg-brand-gold-cta text-brand-navy-deep hover:bg-brand-gold-cta-hover'
              }`}
              aria-label="Shop 3D printed items"
            >
              <ShoppingBag size={17} />
              <span>Store</span>
            </a>
            )}
          </div>

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
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="xl:hidden fixed inset-0 z-[60] flex flex-col bg-[#0E2748] text-[#F5EFE3] animate-fadeIn"
          >
            {/* Menu header: logo + name on the left, close on the right */}
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
              <a
                href="/"
                aria-label="Boxed2Built - Home"
                onClick={() => handleNavClick('logo', '/')}
                className={`flex items-center gap-3 rounded-lg ${MOBILE_FOCUS_RING}`}
              >
                <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white">
                  <img
                    src="/boxed2built_logo.svg"
                    alt=""
                    width="52"
                    height="52"
                    className="h-[52px] w-[52px] object-contain"
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-display text-xl font-bold tracking-[0.01em] text-[#F5EFE3]">
                    Boxed2Built
                  </span>
                  <span className="text-xs text-[#AEB8CC]">Furniture assembly</span>
                </span>
              </a>
              <button
                type="button"
                onClick={toggleMenu}
                aria-label="Close menu"
                className={`grid h-11 w-11 flex-none place-items-center rounded-full border-[1.5px] border-[#F5EFE3]/35 text-[#F5EFE3] transition-colors hover:bg-white/5 ${MOBILE_FOCUS_RING}`}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
              <div className="mt-5 mb-2.5 h-[3px] w-12 rounded-full bg-[#D9A441]" aria-hidden="true" />

              <nav aria-label="Mobile navigation" className="flex flex-col">
                <a
                  ref={firstMobileLinkRef}
                  href="/"
                  aria-current={isActivePage('/') ? 'page' : undefined}
                  onClick={() => handleNavClick('home', '/')}
                  className={mobilePrimaryClass(isActivePage('/'))}
                >
                  Home
                  {isActivePage('/') && (
                    <span aria-hidden="true" className="ml-1 h-2 w-2 rotate-45 bg-[#D9A441]" />
                  )}
                </a>

                <button
                  type="button"
                  onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                  aria-expanded={isMobileServicesOpen}
                  aria-controls="mobile-services-menu"
                  className={mobilePrimaryClass(isActivePage('/services') || isMobileServicesOpen)}
                >
                  <span className="flex-1">Services</span>
                  <span
                    aria-hidden="true"
                    className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
                      isMobileServicesOpen
                        ? 'bg-[#D9A441] text-[#0E2748]'
                        : 'bg-[#F5EFE3]/[0.08] text-[#F5EFE3]'
                    }`}
                  >
                    <ChevronDown
                      size={16}
                      strokeWidth={2.4}
                      className={`transition-transform duration-200 ${isMobileServicesOpen ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {isMobileServicesOpen && (
                  <div
                    id="mobile-services-menu"
                    className="mt-1 mb-2.5 flex flex-col rounded-2xl bg-[#F5EFE3]/[0.06] py-1.5"
                  >
                    {SERVICE_MENU_ITEMS.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        aria-current={isActivePage(item.href) ? 'page' : undefined}
                        onClick={() => handleNavClick(item.trackingId, item.href)}
                        className={`flex min-h-[48px] items-center gap-3 rounded-lg px-4 text-base font-medium transition-colors ${MOBILE_FOCUS_RING} ${
                          isActivePage(item.href) ? 'text-[#D9A441]' : 'text-[#F5EFE3] hover:text-[#D9A441]'
                        }`}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rotate-45 bg-[#D9A441]" />
                        {item.label}
                      </a>
                    ))}
                    <a
                      href="/services"
                      onClick={() => handleNavClick('all_services', '/services')}
                      className={`mt-0.5 flex min-h-[48px] items-center justify-between rounded-lg border-t border-[#F5EFE3]/[0.12] px-4 text-[15px] font-bold text-[#D9A441] ${MOBILE_FOCUS_RING}`}
                    >
                      All services
                      <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                    </a>
                  </div>
                )}

                {MOBILE_PRIMARY_LINKS.map((item) => {
                  const active = isActivePage(item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => handleNavClick(item.label.toLowerCase(), item.href)}
                      className={mobilePrimaryClass(active)}
                    >
                      {item.label}
                      {item.badge && (
                        <span className="rounded-full bg-[#D9A441] px-2 py-1 font-sans text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-[#0E2748]">
                          {item.badge}
                        </span>
                      )}
                      {active && !item.badge && (
                        <span aria-hidden="true" className="ml-1 h-2 w-2 rotate-45 bg-[#D9A441]" />
                      )}
                    </a>
                  );
                })}
              </nav>

              <div className="mt-5 mb-2 flex items-center gap-3" aria-hidden="true">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#8592AD]">More</span>
                <span className="h-px flex-1 bg-[#F5EFE3]/[0.14]" />
              </div>

              <nav aria-label="More pages" className="grid grid-cols-2 gap-2">
                {MOBILE_SECONDARY_LINKS.map((item) => {
                  const active = isActivePage(item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => handleNavClick(item.label.toLowerCase(), item.href)}
                      className={mobileTileClass(active)}
                    >
                      {item.label}
                      <ChevronRight size={14} strokeWidth={2.4} className="text-[#8592AD]" aria-hidden="true" />
                    </a>
                  );
                })}
              </nav>

              {/* Calls to action */}
              <div className="mt-8 flex flex-col gap-2.5">
                <a
                  href="/contact"
                  onClick={() => handleNavClick('free_quote', '/contact')}
                  className={`flex h-14 items-center justify-center gap-2.5 rounded-[14px] bg-[#D9A441] text-[17px] font-bold text-[#0E2748] shadow-[0_8px_20px_rgba(217,164,65,0.25)] transition-colors hover:bg-[#E9BE6A] ${MOBILE_FOCUS_RING}`}
                >
                  Get My Free Quote
                  <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
                </a>

                {bookingEnabled && (
                  <a
                    href="/book"
                    onClick={() => handleNavClick('book', '/book')}
                    className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-brand-teal-cta text-[15px] font-bold text-white transition-colors hover:bg-brand-teal-cta-hover ${MOBILE_FOCUS_RING}`}
                  >
                    <CalendarCheck size={18} aria-hidden="true" />
                    Book Now
                  </a>
                )}

                {hasStoreProducts && cartCount > 0 && (
                  <button
                    type="button"
                    onClick={openCart}
                    className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#D9A441] text-[15px] font-bold text-[#D9A441] transition-colors hover:bg-[#D9A441]/10 ${MOBILE_FOCUS_RING}`}
                  >
                    <ShoppingCart size={18} aria-hidden="true" />
                    View cart
                    <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#D9A441] px-1.5 text-sm font-bold text-[#0E2748]">
                      {cartCount}
                    </span>
                  </button>
                )}

                <div className={`grid gap-2.5 ${hasStoreProducts ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <a
                    href="tel:+16154034538"
                    onClick={() => handleNavClick('phone', 'tel:+16154034538')}
                    aria-label="Call Boxed2Built at (615) 403-4538"
                    className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#F5EFE3]/30 text-[15px] font-medium text-[#F5EFE3] transition-colors hover:bg-white/5 ${MOBILE_FOCUS_RING}`}
                  >
                    <Phone size={17} aria-hidden="true" />
                    (615) 403-4538
                  </a>
                  {hasStoreProducts && (
                    <a
                      href="/store"
                      onClick={() => handleNavClick('store', '/store')}
                      className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#F5EFE3]/30 text-[15px] font-medium text-[#F5EFE3] transition-colors hover:bg-white/5 ${MOBILE_FOCUS_RING}`}
                    >
                      <ShoppingBag size={17} aria-hidden="true" />
                      Store
                    </a>
                  )}
                </div>

                <p className="mt-2.5 text-center font-display text-sm italic text-[#AEB8CC]">
                  We assemble. You enjoy!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ScrollProgressBar />
    </header>
  );
};

export default Header;
