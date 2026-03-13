import React from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../../utils/analytics';

interface InternalLinkProps {
  to?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
  trackingCategory?: string;
  rel?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const InternalLink: React.FC<InternalLinkProps> = ({
  to,
  href,
  children,
  className = 'text-blue-700 hover:text-blue-800 underline font-medium transition-colors',
  title,
  'aria-label': ariaLabel,
  trackingCategory = 'internal_link',
  rel,
  onClick,
  ...props
}) => {
  const linkPath = to || href || '/';

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    trackEvent('internal-link-click', linkPath, {
      event_category: trackingCategory,
      event_label: linkPath,
      user_engagement: 'internal_navigation'
    });

    onClick?.(event);
  };

  return (
    <Link
      to={linkPath}
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
};

export default InternalLink;
