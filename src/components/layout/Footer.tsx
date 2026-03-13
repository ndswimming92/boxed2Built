import React from 'react';
import { Facebook, Mail, Phone, Instagram, Star, Youtube, Clock, MapPin, CreditCard } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import InternalLink from '../ui/InternalLink';
import QuickContactForm from '../QuickContactForm';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

const currentYear = new Date().getFullYear();

const footerLinkSections = [
  {
    title: 'Services',
    links: [
      { href: '/services', label: 'Services & Pricing' },
      { href: '/services/furniture-assembly', label: 'Furniture Assembly' },
      { href: '/services/tv-mounting', label: 'TV Mounting' },
    ],
  },
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
    title: 'Support',
    links: [{ href: '/faq', label: 'FAQ' }],
  },
];

const clientAccessLinks = [
  { href: '/portal/login', label: 'Client Login' },
  { href: '/lookup-request', label: 'Look Up Request' },
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
  const email = businessData?.info?.email || 'boxed2builtco@gmail.com';
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
    <footer className="bg-gray-900 text-white pt-10 pb-6">
      <div className="container mx-auto px-4">
        {/* Top Grid (mobile-first, tight) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mb-8">
          {/* Brand + NAP */}
          <div>
            <div className="flex items-center justify-center md:justify-start mb-3">
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

            <p className="text-gray-300 text-sm leading-relaxed text-center md:text-left mb-5">
              Professional furniture assembly for IKEA, Target, Walmart & all major brands — serving{' '}
              {locality}, {region} and nearby communities.
            </p>

            <p className="text-blue-200 text-sm font-semibold italic text-center md:text-left mb-5">
              {slogan}
            </p>

            <div className="text-center md:text-left">
              <NAPConsistency data={napData} showAddress={true} variant="footer" />
            </div>

            {/* Review CTA */}
            <div className="mt-5 flex flex-col items-center md:items-start gap-3">
              <a
                href={getGoogleReviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition text-sm"
                aria-label="Leave Boxed2Built a Google review"
                onClick={handleReviewClick}
              >
                <Star size={16} className="fill-current mr-2" />
                Leave a Google Review
              </a>

              <p className="text-[11px] text-gray-300">
                Reviews help local families find us faster.
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer navigation">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:gap-x-10">
              {footerLinkSections.map((section) => (
                <div key={section.title}>
                  <h3 className="font-semibold text-white mb-2 text-sm uppercase tracking-wide">{section.title}</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <InternalLink
                          href={link.href}
                          className="hover:text-white transition-colors"
                          trackingCategory="footer_nav"
                        >
                          {link.label}
                        </InternalLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-gray-700/80 pt-4 bg-gray-800/40 rounded-lg px-4 py-3">
              <h3 className="font-semibold text-blue-100 mb-2 text-xs uppercase tracking-[0.16em]">Client Access</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                {clientAccessLinks.map((link) => (
                  <li key={link.href}>
                    <InternalLink
                      href={link.href}
                      className="inline-flex items-center hover:text-white transition-colors"
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
          </nav>

          {/* Hours + Areas + Payment */}
          <div>
            <h3 className="font-semibold text-white mb-3 text-base flex items-center gap-2">
              <Clock size={18} className="text-emerald-400" />
              Business Hours
            </h3>

            <ul className="space-y-2 text-sm text-gray-300">
              {openDays.length > 0 ? (
                openDays.map((hour, index) => (
                  <li key={index}>
                    <span className="font-medium text-white">{hour.day_of_week}:</span>{' '}
                    {hour.opens && hour.closes ? `${formatTime(hour.opens)} – ${formatTime(hour.closes)}` : 'Closed'}
                  </li>
                ))
              ) : (
                <li>
                  <span className="font-medium text-white">Mon–Fri:</span> 8:00 AM – 6:00 PM
                </li>
              )}

              {closedDays.length > 0 && (
                <li className="text-gray-400 italic text-xs pt-1">
                  Closed: {closedDays.map((h) => h.day_of_week).join(', ')}
                </li>
              )}
            </ul>

            <div className="mt-6">
              <h3 className="font-semibold text-white mb-3 text-base flex items-center gap-2">
                <MapPin size={18} className="text-blue-300" />
                Service Areas
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {serviceAreas.length > 0
                  ? `${serviceAreas.slice(0, 6).join(' • ')}${serviceAreas.length > 6 ? ' • …' : ''}`
                  : `${locality}, ${region}`}
              </p>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-white mb-3 text-base flex items-center gap-2">
                <CreditCard size={18} className="text-amber-300" />
                Payment
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {paymentMethods.length > 0 ? paymentMethods.join(' • ') : 'Credit/Debit Cards • Cash'}
              </p>
              <p className="text-[11px] text-gray-400 mt-2 italic">Payment due upon completion.</p>
            </div>
          </div>
        </div>

        {/* Social + Contact Row */}
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-4">
              <span className="text-sm text-gray-300 font-medium">Connect with us</span>
              <div className="flex items-center gap-4">
                {socialMedia.map((social) => {
                  const platform = social.platform.toLowerCase();
                  const label = social.platform;

                  let Icon = Mail;
                  if (platform.includes('facebook')) Icon = Facebook;
                  else if (platform.includes('instagram')) Icon = Instagram;
                  else if (platform.includes('youtube')) Icon = Youtube;

                  return (
                    <a
                      key={social.id}
                      href={getSocialUrl(platform, social.profile_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white transition-colors"
                      aria-label={label}
                      onClick={() => handleSocialClick(platform)}
                    >
                      <Icon size={22} title={label} />
                    </a>
                  );
                })}

                <a
                  href={`mailto:${email}?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer`}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Email Boxed2Built"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={22} title="Email" />
                </a>

                <a
                  href={`tel:${phoneTel}`}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Call Boxed2Built"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone size={22} title="Phone" />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-gray-300 text-center md:text-right leading-relaxed">
              Local furniture assembly near you — serving {locality}, {region} and nearby areas.
              {' '}
              <InternalLink
                href="/services"
                className="text-blue-100 hover:text-white underline"
                trackingCategory="footer_content"
              >
                View services
              </InternalLink>
              .
            </p>
          </div>

          {/* Quick Contact Form */}
          <div className="mt-8 max-w-2xl mx-auto">
            <QuickContactForm />
          </div>

          <div className="text-center text-xs text-gray-300 mt-6 space-y-2">
            <div>&copy; {currentYear} {businessName}. All rights reserved.</div>
            <div className="text-[11px] text-gray-400">
              {businessName} is an Amazon Associate and earns from qualifying purchases.
            </div>

            {/* Keep these as simple links for convenience */}
            <div className="text-xs">
              <a
                href="/privacy-policy"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() =>
                  trackEvent('link_click', 'footer', {
                    event_category: 'navigation',
                    event_label: 'privacy_policy',
                    element_type: 'link',
                    element_location: 'footer',
                    page_section: 'footer',
                    action_type: 'click',
                    action_value: '/privacy-policy',
                  })
                }
              >
                Privacy Policy
              </a>
              <span className="mx-2 text-gray-500">|</span>
              <a
                href="/terms-of-service"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() =>
                  trackEvent('link_click', 'footer', {
                    event_category: 'navigation',
                    event_label: 'terms_of_service',
                    element_type: 'link',
                    element_location: 'footer',
                    page_section: 'footer',
                    action_type: 'click',
                    action_value: '/terms-of-service',
                  })
                }
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
