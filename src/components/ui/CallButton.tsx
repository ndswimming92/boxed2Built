import React from 'react';
import { Phone } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { BUSINESS_INFO } from '../../constants/localSEO';

interface CallButtonProps {
  size?: 'md' | 'lg';
  pageSection: string;
  className?: string;
  fullWidth?: boolean;
}

const CallButton: React.FC<CallButtonProps> = ({
  size = 'md',
  pageSection,
  className = '',
  fullWidth = false
}) => {
  const handlePhoneClick = () => {
    trackEvent('phone_click', pageSection, {
      event_category: 'contact',
      event_label: `phone_click_${pageSection}`,
      value: 1,
      user_engagement: 'phone_click',
      element_type: 'link',
      element_location: pageSection,
      page_section: pageSection,
      action_type: 'phone_click',
      conversion_type: 'phone_lead'
    });
  };

  const sizeClasses = {
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const iconSizes = {
    md: 18,
    lg: 20
  };

  const baseClasses = className || 'bg-green-700 hover:bg-green-800 text-white';

  return (
    <a
      href="tel:+16155511402"
      onClick={handlePhoneClick}
      className={`inline-flex items-center justify-center ${sizeClasses[size]} ${baseClasses} font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group ${fullWidth ? 'w-full' : ''}`}
      aria-label="Call Boxed2Built at (615) 551-1402"
      itemProp="telephone"
    >
      <Phone size={iconSizes[size]} className="mr-2 group-hover:animate-pulse" />
      <span className="font-bold">{BUSINESS_INFO.phoneFormatted}</span>
    </a>
  );
};

export default CallButton;
