import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

export interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  const handleBreadcrumbClick = (label: string, href: string) => {
    trackEvent('breadcrumb-click', href, {
      event_category: 'navigation',
      event_label: label,
      user_engagement: 'breadcrumb_navigation'
    });
  };

  return (
    <nav 
      className={`flex items-center space-x-1 text-sm ${className}`}
      aria-label="Breadcrumb navigation"
    >
      <ol className="flex items-center space-x-1" itemScope itemType="https://schema.org/BreadcrumbList">
        {items.map((item, index) => (
          <li 
            key={index}
            className="flex items-center"
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <meta itemProp="position" content={(index + 1).toString()} />
            
            {index === 0 && (
              <Home size={14} className="mr-1 text-gray-500" aria-hidden="true" />
            )}
            
            {item.current ? (
              <span 
                className="text-gray-600 font-medium"
                aria-current="page"
                itemProp="name"
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="text-blue-700 hover:text-blue-800 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
                onClick={() => handleBreadcrumbClick(item.label, item.href)}
                itemProp="item"
              >
                <span itemProp="name">{item.label}</span>
              </a>
            )}
            
            {index < items.length - 1 && (
              <ChevronRight 
                size={14} 
                className="mx-2 text-gray-400" 
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;