import React from 'react';
import { ServiceArea } from '../../lib/supabase';

interface ServiceAreaSchemaProps {
  businessName: string;
  businessUrl: string;
  serviceAreas: ServiceArea[];
}

const ServiceAreaSchema: React.FC<ServiceAreaSchemaProps> = ({
  businessName,
  businessUrl,
  serviceAreas
}) => {
  if (!serviceAreas || serviceAreas.length === 0) {
    return null;
  }

  const schemaData = serviceAreas.map(area => {
    const areaSchema: any = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": `${businessName} - ${area.city_name} Service Area`,
      "provider": {
        "@type": "LocalBusiness",
        "name": businessName,
        "url": businessUrl
      },
      "areaServed": {
        "@type": "City",
        "name": area.city_name,
        "addressRegion": area.region,
        "addressCountry": area.country
      }
    };

    if (area.latitude && area.longitude) {
      areaSchema.areaServed.geo = {
        "@type": "GeoCoordinates",
        "latitude": area.latitude.toString(),
        "longitude": area.longitude.toString()
      };

      if (area.radius_miles) {
        areaSchema.areaServed.geoRadius = {
          "@type": "GeoCircle",
          "geoMidpoint": {
            "@type": "GeoCoordinates",
            "latitude": area.latitude.toString(),
            "longitude": area.longitude.toString()
          },
          "geoRadius": `${area.radius_miles} miles`
        };
      }
    }

    if (area.postal_codes && area.postal_codes.length > 0) {
      areaSchema.areaServed.postalCode = area.postal_codes;
    }

    return areaSchema;
  });

  return (
    <>
      {schemaData.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema, null, 2)
          }}
        />
      ))}
    </>
  );
};

export default ServiceAreaSchema;
