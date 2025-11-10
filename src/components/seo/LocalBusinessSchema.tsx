import React from 'react';

interface LocalBusinessSchemaProps {
  businessName?: string;
  description?: string;
  address?: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  phone: string;
  email: string;
  website: string;
  serviceAreas: string[];
  services: Array<{
    name: string;
    description: string;
    price?: string;
  }>;
  openingHours?: string[];
  paymentAccepted?: string[];
  priceRange?: string;
  founder?: string;
  yearEstablished?: string;
  socialMediaUrls?: string[];
  reviews?: Array<{
    author: string;
    reviewBody: string;
    ratingValue: number;
    datePublished: string;
  }>;
  includeReviews?: boolean;
}

const LocalBusinessSchema: React.FC<LocalBusinessSchemaProps> = ({
  businessName = "Boxed2Built",
  description = "Professional furniture assembly and handyman services in Spring Hill, TN. Expert IKEA, Target, Walmart assembly. Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood TN.",
  address = {
    addressLocality: "Spring Hill",
    addressRegion: "TN",
    addressCountry: "US",
    postalCode: "37174"
  },
  phone,
  email,
  website,
  serviceAreas,
  services,
  openingHours = ["Sa 09:00-16:00", "Su 13:30-16:00"],
  paymentAccepted = ["Cash", "Credit Card", "Debit Card", "Apple Pay", "Venmo", "Zelle", "Contactless Payments", "Square"],
  priceRange = "$85-$610",
  founder = "Nicholas Davidson",
  yearEstablished = "2024",
  socialMediaUrls = [],
  reviews = [],
  includeReviews = false
}) => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${website}/#business`,
    "name": businessName,
    "alternateName": `${businessName} Furniture Assembly`,
    "description": description,
    "url": website,
    "telephone": phone,
    "email": email,
    "priceRange": priceRange,
    "currenciesAccepted": "USD",
    "paymentAccepted": paymentAccepted.join(", "),
    "foundingDate": yearEstablished,
    "founder": {
      "@type": "Person",
      "name": founder
    },
    "slogan": "We turn boxes into comfort so families can focus on what matters most",
    "knowsAbout": [
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
      "Lawn Chair Assembly"
    ],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": address.streetAddress || "",
      "addressLocality": address.addressLocality,
      "addressRegion": address.addressRegion,
      "addressCountry": address.addressCountry,
      "postalCode": address.postalCode || ""
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "35.7512",
      "longitude": "-86.9300",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": address.addressLocality,
        "addressRegion": address.addressRegion,
        "addressCountry": address.addressCountry
      }
    },
    "areaServed": serviceAreas.map(area => ({
      "@type": "City",
      "name": area.split(',')[0].trim(),
      "addressRegion": address.addressRegion,
      "addressCountry": address.addressCountry
    })),
    "serviceType": [
      "Furniture Assembly Service",
      "Handyman Services",
      "IKEA Assembly",
      "Home Assembly Services"
    ],
    "category": [
      "Furniture Assembly",
      "Handyman Services",
      "Home Services",
      "Assembly Services"
    ],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Furniture Assembly Services",
      "itemListElement": services.map((service, index) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": service.name,
          "description": service.description
        },
        "price": service.price || "85",
        "priceCurrency": "USD"
      }))
    },
    "openingHours": openingHours,
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:00",
        "closes": "16:00"
      },
      {
        "@type": "OpeningHoursSpecification", 
        "dayOfWeek": "Sunday",
        "opens": "13:30",
        "closes": "16:00"
      }
    ],
    "image": `${website}/Modern Minimalist Logo for Boxed2Built.png`,
    "logo": `${website}/Modern Minimalist Logo for Boxed2Built.png`,
    "sameAs": socialMediaUrls,
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": phone,
        "contactType": "customer service",
        "areaServed": address.addressRegion,
        "availableLanguage": "English",
        "contactOption": "TollFree"
      },
      {
        "@type": "ContactPoint",
        "email": email,
        "contactType": "customer service",
        "areaServed": address.addressRegion,
        "availableLanguage": "English"
      }
    ],
    "potentialAction": [
      {
        "@type": "ReserveAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://calendly.com/boxed2built/30min",
          "actionPlatform": [
            "https://schema.org/DesktopWebPlatform",
            "https://schema.org/MobileWebPlatform"
          ]
        },
        "result": {
          "@type": "Reservation",
          "name": "Furniture Assembly Consultation"
        }
      },
      {
        "@type": "CommunicateAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `tel:${phone}`,
          "actionPlatform": [
            "https://schema.org/DesktopWebPlatform",
            "https://schema.org/MobileWebPlatform"
          ]
        }
      }
    ]
  };

  // Add reviews only if explicitly enabled (only on homepage to avoid duplicate aggregate ratings)
  if (includeReviews && reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.ratingValue, 0);
    const averageRating = totalRating / reviews.length;
    const minRating = Math.min(...reviews.map(r => r.ratingValue));

    schemaData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": averageRating.toFixed(1),
      "reviewCount": reviews.length.toString(),
      "bestRating": "5",
      "worstRating": minRating.toString()
    };

    schemaData.review = reviews.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.ratingValue.toString(),
        "bestRating": "5"
      },
      "reviewBody": review.reviewBody,
      "datePublished": review.datePublished
    }));
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

export default LocalBusinessSchema;