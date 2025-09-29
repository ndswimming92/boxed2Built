import React from 'react';
import { trackEvent } from '../../utils/analytics';

interface InternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
  trackingCategory?: string;
  rel?: string;
}

const InternalLink: React.FC<InternalLinkProps> = ({
  href,
  children,
  className = 'text-blue-700 hover:text-blue-800 underline font-medium transition-colors',
  title,
  'aria-label': ariaLabel,
  trackingCategory = 'internal_link',
  rel,
  ...props
}) => {
  const handleClick = () => {
    trackEvent('internal-link-click', href, {
      event_category: trackingCategory,
      event_label: href,
      user_engagement: 'internal_navigation'
    });
  };

  return (
    <a
      href={href}
      className={className}
      title={title}
      aria-label={ariaLabel}
      rel={rel}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
};

export default InternalLink;