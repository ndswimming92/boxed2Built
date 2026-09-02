import React from 'react';
import { Facebook, Mail, Phone, Instagram, Star, Youtube, Linkedin, Clock, MapPin, CreditCard, ArrowRight } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import InternalLink from '../ui/InternalLink';
import QuickContactForm from '../QuickContactForm';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { useBookingEnabled } from '../../hooks/useBookingPublicInfo';
import { calculateRatingStats, getWrittenReviews } from '../../utils/ratingCalculations';
import { SERVICE_LOCATIONS, locationPath } from '../../constants/serviceLocations';
import { SERVICE_LANDING_PAGES } from '../../constants/serviceLandingPages';

const currentYear = new Date().getFullYear();

// Google "G" logo mark, used on the footer review CTA button.
const GoogleGIcon: React.FC = () => (
  <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

const serviceLinksSection = {
  title: 'Services',
  links: [
    { href: '/services', label: 'Services & Pricing' },
    { href: '/services/furniture-assembly', label: 'Furniture Assembly' },
    { href: '/services/tv-mounting', label: 'TV Mounting' },
    ...SERVICE_LANDING_PAGES.map((page) => ({
      href: `/services/${page.slug}`,
      label: page.navLabel,
    })),
  ],
};

const serviceAreaLinksSection = {
  title: 'Service Areas',
  links: [
    { href: '/service-areas', label: 'All Service Areas' },
    ...SERVICE_LOCATIONS.map((location) => ({
      href: locationPath(location.slug),
      label: `${location.shortLabel}, ${location.region}`,
    })),
  ],
};

const footerLinkSections = [
  {
    title: 'Company',
    links: [
      { href: '/book', label: 'Book a Time' },
      { href: '/', label: 'Home' },
      { href: '/about', label: 'About' },
      { href: '/partners', label: 'Partners' },
      { href: '/gallery', label: 'Gallery' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Gift Cards',
    links: [
      { href: '/gift-cards', label: 'Buy a Gift Card' },
      { href: '/redeem-gift-card', label: 'Redeem a Gift Card' },
    ],
  },
  {
    title: 'Support',
    links: [{ href: '/faq', label: 'FAQ' }],
  },
];

const clientAccessLinks = [
  { href: '/portal/login', label: 'Customer Login' },
  { href: '/lookup-request', label: 'Look Up Request' },
];

const sitemapLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services & Pricing' },
  { href: '/services/furniture-assembly', label: 'Furniture Assembly' },
  { href: '/services/tv-mounting', label: 'TV Mounting' },
  ...SERVICE_LANDING_PAGES.map((page) => ({
    href: `/services/${page.slug}`,
    label: page.navLabel,
  })),
  { href: '/service-areas', label: 'Service Areas' },
  ...SERVICE_LOCATIONS.map((location) => ({
    href: locationPath(location.slug),
    label: `${location.shortLabel}, ${location.region}`,
  })),
  { href: '/partners', label: 'Partners' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/book', label: 'Book a Time' },
  { href: '/faq', label: 'FAQ' },
  { href: '/gift-cards', label: 'Gift Cards' },
  { href: '/redeem-gift-card', label: 'Redeem Gift Card' },
  { href: '/portal/login', label: 'Customer Login' },
  { href: '/lookup-request', label: 'Look Up Request' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
];

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Avatar backgrounds cycle through the brand tints so adjacent bubbles read distinctly.
const AVATAR_TINTS = ['bg-blue-700', 'bg-green-700', 'bg-amber-700'];

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

// Prefer a consistent "tel:" format
const toTelHref = (rawPhone: string) => {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return rawPhone.startsWith('+') ? rawPhone : `+1${digits}`;
};

/**
 * Booking links are dropped rather than shown broken when booking is switched
 * off, so the footer never sends someone to a page that turns them away.
 */
const withoutBookingWhenClosed = <T extends { href: string }>(
  links: T[],
  bookingEnabled: boolean,
): T[] => links.filter((link) => link.href !== '/book' || bookingEnabled);

const Footer: React.FC = () => {
  const bookingEnabled = useBookingEnabled();
  const visibleSitemapLinks = withoutBookingWhenClosed(sitemapLinks, bookingEnabled);
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const businessName = businessData?.info?.name || 'Boxed2Built';
  const phoneRaw = businessData?.info?.phone || '+16154034538';
  const phoneTel = toTelHref(phoneRaw);
  const email = businessData?.info?.email || 'nicholas.davidson@boxed2built.com';
  const website = businessData?.info?.website || 'https://boxed2built.com';
  const slogan = businessData?.info?.slogan || 'Turning boxes into comfort, one home at a time.';
  const locality = businessData?.address?.address_locality || 'Spring Hill';
  const region = businessData?.address?.address_region || 'TN';

  const serviceAreas =
    businessData?.serviceAreas?.map((area) => `${area.city_name}, ${area.region}`) || [];
  const paymentMethods = businessData?.paymentMethods?.map((pm) => pm.method_name) || [];
  const socialMedia = (businessData?.socialMedia || []).filter((social) => {
    const platform = social.platform.toLowerCase();
    return !platform.includes('email');
  });
  const businessHours = businessData?.businessHours || [];

  // Real review data drives the review CTA card — no hardcoded counts.
  const reviews = businessData?.reviews || [];
  const reviewStats = calculateRatingStats(reviews);
  // Initials come from named reviewers; the overflow badge counts every rating,
  // so the avatars plus "+N" add up to the total quoted in the copy below.
  const avatarReviews = getWrittenReviews(reviews).slice(0, 3);
  const overflowCount = reviews.length - avatarReviews.length;
  const roundedRating = Math.round(reviewStats.averageRating);
  const allFiveStar =
    reviewStats.totalReviews > 0 && reviewStats.distribution[5] === reviewStats.totalReviews;

  const handleSocialClick = (platform: string) => {
    trackEvent('social_click', 'footer', {
      event_category: 'social_media',
      event_label: `social_click_${platform}`,
      user_engagement: 'social_click',
      element_type: 'link',
      element_location: 'footer',
      page_section: 'footer',
      action_type: 'social_click',
      action_value: platform,
    });
  };

  const handleReviewClick = () => {
    trackEvent('review_click', 'footer', {
      event_category: 'review',
      event_label: 'google_review_click',
      value: 1,
      user_engagement: 'review_click',
      element_type: 'button',
      element_location: 'footer',
      page_section: 'footer',
      action_type: 'review_click',
      conversion_type: 'review_request',
    });
    trackExternalLink(getGoogleReviewUrl(), 'Google Review');
  };

  const napData = {
    businessName,
    phone: phoneRaw,
    email,
    address: businessData?.address
      ? {
          streetAddress: businessData.address.street_address,
          addressLocality: businessData.address.address_locality,
          addressRegion: businessData.address.address_region,
          postalCode: businessData.address.postal_code || '',
          addressCountry: businessData.address.address_country,
        }
      : {
          addressLocality: locality,
          addressRegion: region,
          addressCountry: 'US',
        },
    serviceAreas,
    website,
  };

  if (loading) {
    return (
      <footer className="bg-gray-900 text-white pt-10 pb-6">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-48 mb-3"></div>
            <div className="h-4 bg-gray-700 rounded w-64"></div>
          </div>
        </div>
      </footer>
    );
  }

  const openDays = businessHours.filter((h) => !h.is_closed);
  const closedDays = businessHours.filter((h) => h.is_closed);

  return (
    <footer className="bg-gray-900 text-white pt-12 pb-6">
      <div className="container mx-auto px-4">

        {/* Top section — 3-col grid: Brand | Hours+Info | CTA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12 mb-10">

          {/* Col 1: Brand + NAP + Social */}
          <div className="flex flex-col">
            <div className="flex items-center justify-center md:justify-start mb-4">
              <img
                src="/boxed2built_logo_white.svg"
                alt={`${businessName} - Furniture Assembly in ${locality}, ${region}`}
                loading="lazy"
                className="h-16 w-auto object-contain"
                width="56"
                height="56"
                style={{ aspectRatio: '1/1' }}
                decoding="async"
              />
            </div>

            <p className="text-gray-300 text-sm leading-relaxed text-center md:text-left mb-3">
              Professional furniture assembly for IKEA, Target, Walmart & all major brands — serving{' '}
              {locality}, {region} and nearby communities.
            </p>

            <p className="text-blue-200 text-sm font-semibold italic text-center md:text-left mb-5">
              {slogan}
            </p>

            <div className="text-center md:text-left mb-5">
              <NAPConsistency data={napData} showAddress={true} variant="footer" />
            </div>

            {/* Social icons */}
            <div className="flex items-center justify-center md:justify-start gap-4 mt-auto">
              {socialMedia.map((social) => {
                const platform = social.platform.toLowerCase();
                const label = social.platform;
                let Icon = Mail;
                if (platform.includes('facebook')) Icon = Facebook;
                else if (platform.includes('instagram')) Icon = Instagram;
                else if (platform.includes('youtube')) Icon = Youtube;
                else if (platform.includes('linkedin')) Icon = Linkedin;
                return (
                  <a
                    key={social.id}
                    href={getSocialUrl(platform, social.profile_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label={label}
                    onClick={() => handleSocialClick(platform)}
                  >
                    <Icon size={20} />
                  </a>
                );
              })}
              <a
                href={`mailto:${email}?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer`}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Email Boxed2Built"
                onClick={() => handleSocialClick('email')}
              >
                <Mail size={20} />
              </a>
              <a
                href={`tel:${phoneTel}`}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Call Boxed2Built"
                onClick={() => handleSocialClick('phone')}
              >
                <Phone size={20} />
              </a>
            </div>
          </div>

          {/* Col 2: Hours + Service Areas + Payment */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                <Clock size={15} className="text-emerald-400" />
                Business Hours
              </h3>
              <ul className="space-y-1.5 text-sm text-gray-300">
                {openDays.length > 0 ? (
                  openDays.map((hour, index) => (
                    <li key={index} className="flex justify-between gap-4">
                      <span className="font-medium text-white">{hour.day_of_week}</span>
                      <span>
                        {hour.opens && hour.closes
                          ? `${formatTime(hour.opens)} – ${formatTime(hour.closes)}`
                          : 'Closed'}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="flex justify-between gap-4">
                    <span className="font-medium text-white">Mon–Fri</span>
                    <span>8:00 AM – 6:00 PM</span>
                  </li>
                )}
                {closedDays.length > 0 && (
                  <li className="text-gray-500 italic text-xs pt-1">
                    Closed: {closedDays.map((h) => h.day_of_week).join(', ')}
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                <MapPin size={15} className="text-blue-300" />
                Service Areas
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {serviceAreas.length > 0
                  ? `${serviceAreas.slice(0, 6).join(' • ')}${serviceAreas.length > 6 ? ' • …' : ''}`
                  : `${locality}, ${region}`}
              </p>
              <InternalLink
                href="/service-areas"
                className="text-blue-300 hover:text-white text-sm font-medium mt-1.5 inline-block transition-colors"
                trackingCategory="footer_service_areas"
              >
                See all service areas →
              </InternalLink>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                <CreditCard size={15} className="text-amber-300" />
                Payment
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {paymentMethods.length > 0 ? paymentMethods.join(' • ') : 'Credit/Debit Cards • Cash'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 italic">Payment due upon completion.</p>
            </div>
          </div>

          {/* Col 3: Review CTA + Quick Contact Form */}
          <div className="flex flex-col gap-5">
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-[22px] flex flex-col items-center text-center gap-3.5">
              {/* Stacked reviewer avatars — initials from actual customer reviews */}
              {avatarReviews.length > 0 && (
                <div className="flex items-center" aria-hidden="true">
                  {avatarReviews.map((review, index) => (
                    <span
                      key={review.id}
                      className={`w-[34px] h-[34px] rounded-full ${AVATAR_TINTS[index % AVATAR_TINTS.length]} text-white text-xs font-bold inline-flex items-center justify-center border-2 border-gray-800 ${index > 0 ? '-ml-2.5' : ''}`}
                    >
                      {getInitials(review.author_name)}
                    </span>
                  ))}
                  {overflowCount > 0 && (
                    <span className="w-[34px] h-[34px] rounded-full bg-gray-700 text-gray-200 text-[11px] font-bold inline-flex items-center justify-center border-2 border-gray-800 -ml-2.5">
                      +{overflowCount}
                    </span>
                  )}
                </div>
              )}

              {/* Star rating from actual review average */}
              {reviewStats.totalReviews > 0 && (
                <div
                  className="flex gap-[3px] text-yellow-400"
                  aria-label={`${reviewStats.averageRating.toFixed(1)} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={18}
                      className={i < roundedRating ? 'fill-yellow-400' : 'text-gray-600'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}

              <p className="text-sm leading-snug text-gray-200">
                {reviewStats.totalReviews > 0 ? (
                  <>
                    {allFiveStar ? (
                      <strong className="text-white">
                        {reviewStats.totalReviews} five-star{' '}
                        {reviewStats.totalReviews === 1 ? 'review' : 'reviews'}
                      </strong>
                    ) : (
                      <strong className="text-white">
                        Rated {reviewStats.averageRating.toFixed(1)} out of 5
                      </strong>
                    )}{' '}
                    from families across {locality}. Your feedback keeps us top-rated — and helps
                    neighbors find us faster.
                  </>
                ) : (
                  <>
                    Happy with our service? Leave us a review — it helps local families across{' '}
                    {locality} find us faster.
                  </>
                )}
              </p>

              <a
                href={getGoogleReviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-white text-gray-800 text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-50 hover:shadow-xl transition"
                aria-label="Review Boxed2Built on Google"
                onClick={handleReviewClick}
              >
                <GoogleGIcon />
                Review us on Google
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
            </div>

            <QuickContactForm />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 mb-8" />

        {/* Navigation Links — 4 cols */}
        <nav aria-label="Footer navigation" className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-7">
            {/* Services */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                {serviceLinksSection.title}
              </h3>
              <ul className="space-y-2 text-sm">
                {serviceLinksSection.links.map((link) => (
                  <li key={link.href}>
                    <InternalLink
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                      trackingCategory="footer_nav"
                    >
                      {link.label}
                    </InternalLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Service Areas — one link per local landing page */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                {serviceAreaLinksSection.title}
              </h3>
              <ul className="space-y-2 text-sm">
                {serviceAreaLinksSection.links.map((link) => (
                  <li key={link.href}>
                    <InternalLink
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                      trackingCategory="footer_nav"
                    >
                      {link.label}
                    </InternalLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company + Gift Cards */}
            {footerLinkSections
              .filter((s) => s.title !== 'Support')
              .map((section) => ({
                ...section,
                links: withoutBookingWhenClosed(section.links, bookingEnabled),
              }))
              .map((section) => (
                <div key={section.title}>
                  <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                    {section.title}
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <InternalLink
                          href={link.href}
                          className="text-gray-400 hover:text-white transition-colors"
                          trackingCategory="footer_nav"
                        >
                          {link.label}
                        </InternalLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

            {/* Support + Client Access — merged */}
            <div>
              <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                Help & Access
              </h3>
              <ul className="space-y-2 text-sm">
                {footerLinkSections
                  .filter((s) => s.title === 'Support')
                  .flatMap((s) => s.links)
                  .map((link) => (
                    <li key={link.href}>
                      <InternalLink
                        href={link.href}
                        className="text-gray-400 hover:text-white transition-colors"
                        trackingCategory="footer_nav"
                      >
                        {link.label}
                      </InternalLink>
                    </li>
                  ))}
                {clientAccessLinks.map((link) => (
                  <li key={link.href}>
                    <InternalLink
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                      trackingCategory="footer_nav"
                      onClick={() => {
                        if (link.href === '/portal/login') {
                          trackEvent('client_login_nav_click', 'footer', {
                            event_category: 'navigation',
                            event_label: 'client_login_footer',
                            action_type: 'click',
                            action_value: '/portal/login',
                          });
                        }
                        if (link.href === '/lookup-request') {
                          trackEvent('request_lookup_nav_click', 'footer', {
                            event_category: 'navigation',
                            event_label: 'request_lookup_footer',
                            action_type: 'click',
                            action_value: '/lookup-request',
                          });
                        }
                      }}
                    >
                      {link.label}
                    </InternalLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 text-xs text-gray-500 mb-5">
            <p>&copy; {currentYear} {businessName}. All rights reserved.</p>
            <p className="text-center md:text-right">
              Local furniture assembly near you — serving {locality}, {region} and nearby areas.{' '}
              <InternalLink
                href="/services"
                className="text-gray-400 hover:text-white underline"
                trackingCategory="footer_content"
              >
                View services
              </InternalLink>
              .
            </p>
          </div>

          {/* Sitemap */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600 mb-2 text-center">Sitemap</p>
            <div className="flex flex-wrap justify-center gap-y-1">
              {visibleSitemapLinks.map((link, index) => (
                <React.Fragment key={link.href}>
                  <a
                    href={link.href}
                    className="text-xs text-gray-600 underline hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                    onClick={() =>
                      trackEvent('link_click', 'footer', {
                        event_category: 'navigation',
                        event_label: `sitemap_${link.label.toLowerCase().replace(/\s+/g, '_')}`,
                        element_type: 'link',
                        element_location: 'footer_sitemap',
                        page_section: 'footer',
                        action_type: 'click',
                        action_value: link.href,
                      })
                    }
                  >
                    {link.label}
                  </a>
                  {index < visibleSitemapLinks.length - 1 && (
                    <span className="mx-1 text-gray-700">|</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
