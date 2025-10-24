import React from 'react';

export interface ImageObject {
  url: string;
  caption: string;
  description?: string;
  width?: number;
  height?: number;
  contentUrl?: string;
}

interface ImageObjectSchemaProps {
  images: ImageObject[];
}

const ImageObjectSchema: React.FC<ImageObjectSchemaProps> = ({ images }) => {
  if (!images || images.length === 0) {
    return null;
  }

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "image": images.map(img => ({
      "@type": "ImageObject",
      "contentUrl": img.contentUrl || img.url,
      "url": img.url,
      "caption": img.caption,
      "description": img.description || img.caption,
      ...(img.width && { "width": img.width }),
      ...(img.height && { "height": img.height })
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemaData, null, 2)
      }}
    />
  );
};

export default ImageObjectSchema;
