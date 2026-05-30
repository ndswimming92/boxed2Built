import React from 'react';

export interface ServiceOffer {
  name: string;
  description: string;
  price: string;
  priceCurrency?: string;
}

interface ServiceSchemaProps {
  name: string;
  description: string;
  url: string;
  serviceType: string;
  offers: ServiceOffer[];
  areaServed?: string[];
}

const DEFAULT_AREAS = [
  'Spring Hill, TN',
  'Franklin, TN',
  'Columbia, TN',
  "Thompson's Station, TN",
  'Brentwood, TN',
];

const ServiceSchema: React.FC<ServiceSchemaProps> = ({
  name,
  description,
  url,
  serviceType,
  offers,
  areaServed = DEFAULT_AREAS,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    serviceType,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Boxed2Built',
      url: 'https://boxed2built.com',
      telephone: '+1-615-403-4538',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Spring Hill',
        addressRegion: 'TN',
        postalCode: '37174',
        addressCountry: 'US',
      },
    },
    areaServed: areaServed.map((area) => ({
      '@type': 'City',
      name: area,
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${name} Pricing`,
      itemListElement: offers.map((offer, index) => ({
        '@type': 'Offer',
        position: index + 1,
        name: offer.name,
        description: offer.description,
        price: offer.price,
        priceCurrency: offer.priceCurrency ?? 'USD',
        availability: 'https://schema.org/InStock',
        areaServed: areaServed.map((area) => ({
          '@type': 'City',
          name: area,
        })),
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default ServiceSchema;
