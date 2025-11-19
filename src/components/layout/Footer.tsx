import React from 'react';
import { Facebook, Mail, Phone, Instagram, Star, Youtube } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import InternalLink from '../ui/InternalLink';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getCalendlyUrl, getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const businessName = businessData?.info?.name || 'Boxed2Built';
  const phone = businessData?.info?.phone || '+16154034538';
  const email = businessData?.info?.email || 'boxed2builtco@gmail.com';
  const website = businessData?.info?.website || 'https://boxed2built.com';
  const priceRange = businessData?.info?.price_range || '$85-$610';
  const locality = businessData?.address?.address_locality || 'Spring Hill';
  const region = businessData?.address?.address_region || 'TN';
  const serviceAreas = businessData?.serviceAreas.map(area => `${area.city_name}, ${area.region}`) || [];
  const paymentMethods = businessData?.paymentMethods.map(pm => pm.method_name) || [];
  const socialMedia = businessData?.socialMedia || [];
  const handleSocialClick = (platform: string) => {
    trackEvent('social_click', 'footer', {
      event_category: 'social_media',
      event_label: `social_click_${platform}`,
      user_engagement: 'social_click',
      element_type: 'link',
      element_location: 'footer',
      page_section: 'footer',
      action_type: 'social_click',
      action_value: platform
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
      conversion_type: 'review_request'
    });
    trackExternalLink(getGoogleReviewUrl(), 'Google Review');
  };

  const handleBookingClick = () => {
    trackEvent('booking_click', 'footer', {
      event_category: 'conversion',
      event_label: 'footer_book_consultation',
      value: 1,
      element_type: 'button',
      element_location: 'footer',
      page_section: 'footer',
      action_type: 'booking_click',
      conversion_type: 'calendly_booking'
    });
    window.open(getCalendlyUrl('footer'), '_blank');
  };

  const napData = {
    businessName,
    phone,
    email,
    address: businessData?.address ? {
      streetAddress: businessData.address.street_address,
      addressLocality: businessData.address.address_locality,
      addressRegion: businessData.address.address_region,
      postalCode: businessData.address.postal_code || '',
      addressCountry: businessData.address.address_country,
      coordinates: {
        latitude: String(businessData.address.latitude || 0),
        longitude: String(businessData.address.longitude || 0)
      }
    } : undefined,
    serviceAreas,
    website
  };

  if (loading) {
    return (
      <footer className="bg-gray-900 text-white pt-12 pb-6">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-64"></div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <>
      <footer
        className="bg-gray-900 text-white pt-12 pb-6"
        itemScope
        itemType="https://schema.org/LocalBusiness"
      >
        <meta itemProp="name" content={businessName} />
        <meta itemProp="telephone" content={phone} />
        <meta itemProp="email" content={email} />
        <meta itemProp="url" content={website} />
        <meta itemProp="priceRange" content={priceRange} />
        <meta itemProp="paymentAccepted" content={paymentMethods.join(', ')} />

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Company Info */}
            <div className="md:col-span-1">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img
                  src="/Modern Minimalist Logo for Boxed2Built.png"
                  alt={`${businessName} - Professional Furniture Assembly Service in ${locality} ${region}`}
                  loading="lazy"
                  className="h-12 w-auto object-contain"
                  width="120"
                  height="48"
                  style={{ aspectRatio: '120/48' }}
                  decoding="async"
                />
              </div>
              <p className="text-gray-300 max-w-md mb-6 text-center md:text-left">
                {locality} handyman services specializing in professional furniture assembly. Expert IKEA, Target, Walmart assembly service in {locality}, {region} and surrounding Tennessee areas with flexible scheduling.
              </p>

              {/* NAP Consistency in Footer */}
              <div className="text-center md:text-left mb-4">
                <NAPConsistency 
                  data={napData}
                  showAddress={true}
                  variant="footer"
                />
              </div>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><InternalLink href="/" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Home</InternalLink></li>
                <li><InternalLink href="/about" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">About Us</InternalLink></li>
                <li><InternalLink href="/services" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Services & Pricing</InternalLink></li>
                <li><InternalLink href="/partners" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Partners</InternalLink></li>
                <li><InternalLink href="/gallery" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Gallery</InternalLink></li>
                <li><InternalLink href="/faq" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">FAQ</InternalLink></li>
                <li><InternalLink href="/contact" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Contact</InternalLink></li>
                <li><InternalLink href="/lookup-request" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Look Up Request</InternalLink></li>
                <li><InternalLink href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Privacy Policy</InternalLink></li>
                <li><InternalLink href="/terms-of-service" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Terms of Service</InternalLink></li>
              </ul>
            </div>

            {/* Services */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Our Services</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="text-gray-300">Spring Hill Handyman Services</li>
                <li className="text-gray-300">IKEA Furniture Assembly</li>
                <li className="text-gray-300">Target Furniture Assembly</li>
                <li className="text-gray-300">Walmart Furniture Assembly</li>
                <li className="text-gray-300">Bed Frame Assembly</li>
                <li className="text-gray-300">Dresser Assembly</li>
                <li className="text-gray-300">Desk & Table Assembly</li>
                <li className="text-gray-300">Bookshelf Assembly</li>
                <li className="text-gray-300">Professional Service</li>
              </ul>
            </div>

            {/* Payment Methods */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Payment Methods</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((method, index) => (
                    <li key={index} className="text-gray-300">{method}</li>
                  ))
                ) : (
                  <>
                    <li className="text-gray-300">Credit & Debit Cards</li>
                    <li className="text-gray-300">Cash</li>
                  </>
                )}
              </ul>
              <p className="text-xs text-gray-300 mt-3 italic">
                Payment due upon completion
              </p>
            </div>

            {/* Service Areas */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Service Areas</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {serviceAreas.length > 0 ? (
                  serviceAreas.map((area, index) => (
                    <li key={index} className="text-gray-300">{area}</li>
                  ))
                ) : (
                  <li className="text-gray-300">Spring Hill, TN</li>
                )}
              </ul>
            </div>
          </div>

          {/* Social Links and CTA */}
          <div className="border-t border-gray-800 pt-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex flex-col items-center md:items-start gap-4 mb-6 md:mb-0">
                {/* Social Media Icons */}
                <div className="flex space-x-4 justify-center md:justify-start">
                {socialMedia.map((social) => {
                  let Icon = Mail;
                  let label = social.platform;

                  if (social.platform.toLowerCase().includes('facebook')) Icon = Facebook;
                  else if (social.platform.toLowerCase().includes('instagram')) Icon = Instagram;
                  else if (social.platform.toLowerCase().includes('youtube')) Icon = Youtube;

                  return (
                    <a
                      key={social.id}
                      href={getSocialUrl(social.platform.toLowerCase(), social.profile_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white transition-colors"
                      aria-label={label}
                      onClick={() => handleSocialClick(social.platform.toLowerCase())}
                    >
                      <Icon size={24} title={label} />
                    </a>
                  );
                })}
                <a
                  href={`mailto:${email}?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer`}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={24} title="Email" />
                </a>
                <a
                  href={`tel:${phone}`}
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Phone"
                  itemProp="telephone"
                  onClick={() => handleSocialClick('phone')}
                >
                  <Phone size={24} title="Phone" />
                </a>
                </div>

                {/* Google Review Button */}
                <a
                  href={getGoogleReviewUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                  aria-label="Leave a Google Review"
                  onClick={handleReviewClick}
                >
                  <Star size={16} className="fill-current mr-2" />
                  Leave us a Review!
                </a>
              </div>

              <div className="text-center md:text-right">
                <button
                  onClick={handleBookingClick}
                  className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition shadow-lg"
                >
                  Book Free Consultation →
                </button>
                <p className="text-xs text-gray-300 mt-2">
                  By booking, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced service area description */}
          <p className="text-xs text-gray-200 text-center mt-4">
            Local furniture assembly service near me proudly serving {serviceAreas.slice(0, 5).join(', ')},
            and surrounding Tennessee communities. Expert IKEA, Target, Walmart furniture assembly. View all{' '}
            <InternalLink href="/services" className="text-blue-100 hover:text-white underline" trackingCategory="footer_content">
              our services and areas
            </InternalLink>.
          </p>

          <div className="text-sm text-gray-200 text-center space-y-2 mt-4">
            <div>&copy; {currentYear} {businessName}. All rights reserved.</div>
            <div className="text-xs text-gray-300">
              {businessName} is an Amazon Associate and earns from qualifying purchases.
            </div>
            <div>
              <a 
                href="/privacy-policy"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() => trackEvent('link_click', 'footer', {
                  event_category: 'navigation',
                  event_label: 'privacy_policy',
                  element_type: 'link',
                  element_location: 'footer',
                  page_section: 'footer',
                  action_type: 'click',
                  action_value: '/privacy-policy'
                })}
              >
                Privacy Policy
              </a>
              &nbsp;|&nbsp;
              <a 
                href="/terms-of-service"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() => trackEvent('link_click', 'footer', {
                  event_category: 'navigation',
                  event_label: 'terms_of_service',
                  element_type: 'link',
                  element_location: 'footer',
                  page_section: 'footer',
                  action_type: 'click',
                  action_value: '/terms-of-service'
                })}
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>

    </>
  );
};

export default Footer;