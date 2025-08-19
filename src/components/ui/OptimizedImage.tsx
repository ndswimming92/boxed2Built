import React from 'react';
import { generateResponsiveImageSources } from '../../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  sizes?: string;
  quality?: number;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  quality = 80,
}) => {
  // Use eager loading for priority images
  const imageLoading = priority ? 'eager' : loading;
  
  // Generate responsive image sources
  const sources = generateResponsiveImageSources(src, {
    sizes: [400, 800, 1200, 1600],
    formats: ['webp', 'jpeg'],
    quality
  });

  return (
    <picture className={className}>
      {sources.webp && (
        <source
          srcSet={sources.webp.srcSet}
          sizes={sizes}
          type="image/webp"
        />
      )}
      <source
        srcSet={sources.fallback.srcSet}
        sizes={sizes}
        type="image/jpeg"
      />
      <img
        src={sources.fallback.src}
        alt={alt}
        width={width}
        height={height}
        loading={imageLoading}
        className="w-full h-auto"
        style={{ 
          aspectRatio: width && height ? `${width}/${height}` : undefined
        }}
      />
    </picture>
  );
};

export default OptimizedImage;