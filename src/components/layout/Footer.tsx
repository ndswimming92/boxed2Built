import React, { useState, useRef } from 'react';
import { Facebook, Mail, Phone, Instagram, MapPin, Star, Youtube } from 'lucide-react';
import NAPConsistency from '../seo/NAPConsistency';
import InternalLink from '../ui/InternalLink';
import { trackEvent, trackExternalLink } from '../../utils/analytics';
import { getCalendlyUrl, getSocialUrl, getGoogleReviewUrl } from '../../utils/utm';
import { BUSINESS_INFO, ADDRESS_INFO, SERVICE_AREAS } from '../../constants/localSEO';

const currentYear = new Date().getFullYear();

const Footer: React.FC = () => {
  const handleSocialClick = (platform: string) => {
    trackEvent(`social-click-${platform}`, platform, {
      event_category: 'social_media',
      user_engagement: 'social_click'
    });
  };

  const handleReviewClick = () => {
    trackEvent('google-review-click', 'footer', {
      event_category: 'review',
      value: 1,
      user_engagement: 'review_click'
    });
    trackExternalLink(getGoogleReviewUrl(), 'Google Review');
  };

  const handleBookingClick = () => {
    trackEvent('footer-book-now');
    window.open(getCalendlyUrl('footer'), '_blank');
  };

  const napData = {
    businessName: BUSINESS_INFO.name,
    phone: BUSINESS_INFO.phone,
    email: BUSINESS_INFO.email,
    address: ADDRESS_INFO,
    serviceAreas: SERVICE_AREAS,
    website: BUSINESS_INFO.website
  };

  return (
    <>
      <footer
        className="bg-gray-900 text-white pt-12 pb-6"
        itemScope
        itemType="https://schema.org/LocalBusiness"
      >
        <meta itemProp="name" content={BUSINESS_INFO.name} />
        <meta itemProp="telephone" content={BUSINESS_INFO.phone} />
        <meta itemProp="email" content={BUSINESS_INFO.email} />
        <meta itemProp="url" content={BUSINESS_INFO.website} />
        <meta itemProp="priceRange" content={BUSINESS_INFO.priceRange} />
        <meta itemProp="paymentAccepted" content="Cash, Credit Card, Debit Card" />

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Company Info */}
            <div className="md:col-span-1">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img
                  src="/Modern Minimalist Logo for Boxed2Built.png"
                  alt={`${BUSINESS_INFO.name} - Professional Furniture Assembly Service in Spring Hill TN`}
                  loading="lazy"
                  className="h-12 w-auto object-contain"
                  width="120"
                  height="48"
                  style={{ aspectRatio: '120/48' }}
                  decoding="async"
                />
              </div>
              <p className="text-gray-300 max-w-md mb-6 text-center md:text-left">
                {ADDRESS_INFO.addressLocality} handyman services specializing in professional furniture assembly. Expert IKEA, Target, Walmart assembly service in {ADDRESS_INFO.addressLocality}, {ADDRESS_INFO.addressRegion} and surrounding Tennessee areas with flexible scheduling.
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
                <li><InternalLink href="/contact" className="text-gray-300 hover:text-white transition-colors" trackingCategory="footer_nav">Contact</InternalLink></li>
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
                <li className="text-gray-300">Credit & Debit Cards</li>
                <li className="text-gray-300">Apple Pay</li>
                <li className="text-gray-300">Venmo</li>
                <li className="text-gray-300">Zelle</li>
                <li className="text-gray-300">Contactless Payments</li>
                <li className="text-gray-300">Square</li>
                <li className="text-gray-300">Cash</li>
              </ul>
              <p className="text-xs text-gray-300 mt-3 italic">
                Payment due upon completion
              </p>
            </div>

            {/* Service Areas */}
            <div className="md:col-span-1">
              <h3 className="font-semibold text-white mb-4">Service Areas</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {SERVICE_AREAS.map((area, index) => (
                  <li key={index} className="text-gray-300">{area}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Social Links and CTA */}
          <div className="border-t border-gray-800 pt-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex flex-col items-center md:items-start gap-4 mb-6 md:mb-0">
                {/* Social Media Icons */}
                <div className="flex space-x-4 justify-center md:justify-start">
                <a
                  href={getSocialUrl('facebook', 'https://www.facebook.com/BoxedToBuiltUSA')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Facebook"
                  onClick={() => handleSocialClick('facebook')}
                >
                  <Facebook size={24} title="Facebook" />
                </a>
                <a
                  href={getSocialUrl('instagram', 'https://www.instagram.com/boxed2built/')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Instagram"
                  onClick={() => handleSocialClick('instagram')}
                >
                  <Instagram size={24} title="Instagram" />
                </a>
                <a
                  href={getSocialUrl('youtube', 'https://www.youtube.com/@Boxed2BuiltUSA')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="YouTube"
                  onClick={() => handleSocialClick('youtube')}
                >
                  <Youtube size={24} title="YouTube" />
                </a>
                <a
                  href="mailto:boxed2builtco@gmail.com?subject=Contact%20-%20Footer&body=Source:%20Website%20Footer"
                  className="text-gray-300 hover:text-white transition-colors"
                  aria-label="Email"
                  onClick={() => handleSocialClick('email')}
                >
                  <Mail size={24} title="Email" />
                </a>
                <a
                  href="tel:+16154034538" 
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
            Local furniture assembly service near me proudly serving {SERVICE_AREAS.slice(0, 5).join(', ')}, 
            and surrounding Tennessee communities. Expert IKEA, Target, Walmart furniture assembly. View all{' '}
            <InternalLink href="/services" className="text-blue-100 hover:text-white underline" trackingCategory="footer_content">
              our services and areas
            </InternalLink>.
          </p>

          <div className="text-sm text-gray-200 text-center space-y-2 mt-4">
            <div>&copy; {currentYear} {BUSINESS_INFO.name}. All rights reserved.</div>
            <div className="text-xs text-gray-300">
              {BUSINESS_INFO.name} is an Amazon Associate and earns from qualifying purchases.
            </div>
            <div>
              <a 
                href="/privacy-policy"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() => trackEvent('privacy-policy-footer-click')}
              >
                Privacy Policy
              </a>
              &nbsp;|&nbsp;
              <a 
                href="/terms-of-service"
                className="underline hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                onClick={() => trackEvent('terms-of-service-footer-click')}
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