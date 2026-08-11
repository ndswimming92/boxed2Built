import React from 'react';
import { CompleteBusinessData } from '../../lib/supabase';
import { getWrittenReviews } from '../../utils/ratingCalculations';

interface EnhancedLocalBusinessSchemaProps {
  businessData: CompleteBusinessData | null | undefined;
  includeReviews?: boolean;
  pageType?: string;
}

const EnhancedLocalBusinessSchema: React.FC<EnhancedLocalBusinessSchemaProps> = ({
  businessData,
  includeReviews = false
}) => {
  if (!businessData) return null;

  const { info, address, serviceAreas, services, businessHours, paymentMethods, socialMedia, reviews, attributes } = businessData;

  const openingHoursSpec = businessHours
    .filter(hours => !hours.is_closed && hours.opens && hours.closes)
    .map(hours => ({
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": hours.day_of_week,
      "opens": hours.opens,
      "closes": hours.closes
    }));

  const schemaData: any = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness", "ProfessionalService"],
    "@id": `${info.website}/#localbusiness`,
    "name": info.name,
    "alternateName": info.alternate_name || `${info.name} Furniture Assembly`,
    "description": info.description,
    "url": info.website,
    "telephone": info.phone,
    "email": info.email,
    "priceRange": info.price_range,
    "currenciesAccepted": info.currencies_accepted,
    "paymentAccepted": paymentMethods.map(pm => pm.method_name).join(", "),
    "foundingDate": info.founded_year,
    "slogan": info.slogan,
    "image": info.image_url,
    "logo": info.logo_url
  };

  if (info.founder_name) {
    schemaData.founder = {
      "@type": "Person",
      "name": info.founder_name
    };
  }

  if (address) {
    schemaData.address = {
      "@type": "PostalAddress",
      "streetAddress": address.street_address || "",
      "addressLocality": address.address_locality,
      "addressRegion": address.address_region,
      "addressCountry": address.address_country,
      "postalCode": address.postal_code || ""
    };

    if (address.latitude && address.longitude) {
      schemaData.geo = {
        "@type": "GeoCoordinates",
        "latitude": address.latitude.toString(),
        "longitude": address.longitude.toString()
      };
    }
  }

  if (serviceAreas.length > 0) {
    schemaData.areaServed = serviceAreas.map(area => {
      const areaData: any = {
        "@type": "City",
        "name": area.city_name,
        "addressRegion": area.region,
        "addressCountry": area.country
      };

      if (area.latitude && area.longitude) {
        areaData.geo = {
          "@type": "GeoCoordinates",
          "latitude": area.latitude.toString(),
          "longitude": area.longitude.toString()
        };
      }

      return areaData;
    });
  }

  schemaData.serviceType = [
    "Furniture Assembly Service",
    "Handyman Services",
    "IKEA Assembly",
    "Home Assembly Services"
  ];

  schemaData.knowsAbout = [
    "Furniture Assembly",
    "IKEA Assembly",
    "Target Furniture Assembly",
    "Walmart Furniture Assembly",
    "Handyman Services",
    "TV Mounting",
    "Bed Frame Assembly",
    "Dresser Assembly",
    "Desk Assembly",
    "Bookshelf Assembly",
    "Home Improvement"
  ];

  if (services.length > 0) {
    schemaData.hasOfferCatalog = {
      "@type": "OfferCatalog",
      "name": "Furniture Assembly Services",
      "itemListElement": services.map(service => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": service.name,
          "description": service.description,
          "category": service.category || "Furniture Assembly"
        },
        "price": service.base_price.toString(),
        "priceCurrency": service.price_currency
      }))
    };
  }

  if (openingHoursSpec.length > 0) {
    schemaData.openingHoursSpecification = openingHoursSpec;
  }

  if (socialMedia.length > 0) {
    schemaData.sameAs = socialMedia.map(sm => sm.profile_url);
  }

  schemaData.contactPoint = [
    {
      "@type": "ContactPoint",
      "telephone": info.phone,
      "contactType": "customer service",
      "areaServed": address ? address.address_region : "TN",
      "availableLanguage": "English"
    },
    {
      "@type": "ContactPoint",
      "email": info.email,
      "contactType": "customer service",
      "areaServed": address ? address.address_region : "TN",
      "availableLanguage": "English"
    }
  ];

  schemaData.potentialAction = [
    {
      "@type": "CommunicateAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `tel:${info.phone}`,
        "actionPlatform": [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    }
  ];

  if (attributes.length > 0) {
    const amenityFeatures = attributes.map(attr => ({
      "@type": "LocationFeatureSpecification",
      "name": attr.attribute_name,
      "value": attr.attribute_value
    }));
    schemaData.amenityFeature = amenityFeatures;
  }

  if (includeReviews && reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating_value, 0);
    const averageRating = totalRating / reviews.length;
    // Star-only ratings count toward the total Google shows but have no body, so
    // they belong in ratingCount and must stay out of reviewCount and `review`.
    const writtenReviews = getWrittenReviews(reviews);

    schemaData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": averageRating.toFixed(1),
      "ratingCount": reviews.length.toString(),
      "bestRating": "5",
      "worstRating": "1"
    };

    if (writtenReviews.length > 0) {
      schemaData.aggregateRating.reviewCount = writtenReviews.length.toString();

      schemaData.review = writtenReviews.map(review => ({
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": review.author_name
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": review.rating_value.toString(),
          "bestRating": "5"
        },
        "reviewBody": review.review_body,
        "datePublished": review.date_published
      }));
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemaData, null, 2)
      }}
    />
  );
};

export default EnhancedLocalBusinessSchema;
