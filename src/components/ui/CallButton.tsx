import React from 'react';
import { Phone } from 'lucide-react';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../../services/communicationService';

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
  const { data: businessData } = useBusinessDataWithFallback();
  const phoneRaw = businessData?.info?.phone || '+16154034538';
  const phoneDisplay = formatPhoneForDisplay(phoneRaw.replace(/^\+1/, ''));

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
      href={`tel:${phoneRaw}`}
      data-page-section={pageSection}
      className={`inline-flex items-center justify-center ${sizeClasses[size]} ${baseClasses} font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group ${fullWidth ? 'w-full' : ''}`}
      aria-label={`Call Boxed2Built at ${phoneDisplay}`}
      itemProp="telephone"
    >
      <Phone size={iconSizes[size]} className="mr-2 group-hover:animate-pulse" />
      <span className="font-bold">{phoneDisplay}</span>
    </a>
  );
};

export default CallButton;
