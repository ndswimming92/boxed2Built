import React from 'react';
import type { ServiceLocation } from '../../constants/serviceLocations';
import { SITE_URL, locationLabel, locationUrl } from '../../constants/serviceLocations';

interface LocationServiceSchemaProps {
  location: ServiceLocation;
  /** Offer catalog rendered on the page, so the schema matches the visible pricing. */
  offers?: Array<{ name: string; description: string; price: string; priceCurrency?: string }>;
}

/**
 * Service schema scoped to a single city page.
 *
 * The provider points at the site-wide LocalBusiness node by @id (emitted by
 * EnhancedLocalBusinessSchema) rather than restating the business, so Google
 * reads one business serving many areas instead of nine separate businesses.
 */
const LocationServiceSchema: React.FC<LocationServiceSchemaProps> = ({ location, offers = [] }) => {
  const label = locationLabel(location);
  const url = locationUrl(location.slug);

  const areaServed = {
    '@type': 'City',
    name: location.city,
    addressRegion: location.region,
    addressCountry: 'US',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
    },
  };

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: `Furniture Assembly & TV Mounting in ${label}`,
    description: location.metaDescription,
    url,
    serviceType: 'Furniture Assembly Service',
    provider: {
      '@id': `${SITE_URL}/#localbusiness`,
    },
    areaServed,
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: `${SITE_URL}/contact`,
      servicePhone: {
        '@type': 'ContactPoint',
        telephone: '+1-615-403-4538',
        contactType: 'customer service',
        areaServed: 'US-TN',
        availableLanguage: 'English',
      },
    },
  };

  if (offers.length > 0) {
    schema.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `Furniture Assembly Pricing — ${label}`,
      itemListElement: offers.map((offer, index) => ({
        '@type': 'Offer',
        position: index + 1,
        name: offer.name,
        description: offer.description,
        price: offer.price,
        priceCurrency: offer.priceCurrency ?? 'USD',
        availability: 'https://schema.org/InStock',
        areaServed,
      })),
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default LocationServiceSchema;
