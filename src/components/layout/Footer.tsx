import React from 'react';
import { Facebook, Mail, Phone, Instagram, Star, Youtube, Linkedin, Clock, MapPin, CreditCard } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import InternalLink from '../ui/InternalLink';
import QuickContactForm from '../QuickContactForm';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

const currentYear = new Date().getFullYear();

const serviceLinksSection = {
  title: 'Services',
  links: [
    { href: '/services', label: 'Services & Pricing' },
    { href: '/services/furniture-assembly', label: 'Furniture Assembly' },
    { href: '/services/tv-mounting', label: 'TV Mounting' },
  ],
};

const footerLinkSections = [
  {
    title: 'Company',
    links: [
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
  { href: '/partners', label: 'Partners' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
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

// Prefer a consistent "tel:" format
const toTelHref = (rawPhone: string) => {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return rawPhone.startsWith('+') ? rawPhone : `+1${digits}`;
};

const Footer: React.FC = () => {
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
                src="/white_boxed2built_logo.png"
                alt={`${businessName} - Furniture Assembly in ${locality}, ${region}`}
                loading="lazy"
                className="h-12 w-auto object-contain"
                width="160"
                height="56"
                style={{ aspectRatio: '160/56' }}
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
            <div className="bg-gray-800 rounded-xl p-5 flex flex-col items-center text-center gap-3">
              <Star size={22} className="text-yellow-400 fill-yellow-400" />
              <p className="text-sm text-gray-200 leading-snug">
                Happy with our service? Leave us a review — it helps local families find us faster.
              </p>
              <a
                href={getGoogleReviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-lg shadow transition text-sm w-full"
                aria-label="Leave Boxed2Built a Google review"
                onClick={handleReviewClick}
              >
                Leave a Google Review
              </a>
            </div>

            <QuickContactForm />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 mb-8" />

        {/* Navigation Links — 4 cols */}
        <nav aria-label="Footer navigation" className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-7">
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

            {/* Company + Gift Cards */}
            {footerLinkSections
              .filter((s) => s.title !== 'Support')
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
              {sitemapLinks.map((link, index) => (
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
                  {index < sitemapLinks.length - 1 && (
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
