import React from 'react';
import { generateResponsiveImageSources, getOptimalQuality } from '../../utils/imageOptimization';

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
  imageType?: 'hero' | 'thumbnail' | 'gallery' | 'icon';
  enableAvif?: boolean;
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
  quality,
  imageType = 'gallery',
  enableAvif = true,
}) => {
  // Use eager loading for priority images
  const imageLoading = priority ? 'eager' : loading;
  
  // Get optimal quality if not specified
  const optimalQuality = quality || getOptimalQuality(imageType, 'webp');
  
  // Generate responsive image sources
  const sources = generateResponsiveImageSources(src, {
    sizes: [320, 640, 960, 1280, 1600],
    formats: ['webp', 'jpeg'],
    quality: optimalQuality,
    enableAvif
  });

  return (
    <picture className={className}>
      {/* AVIF format - most efficient */}
      {enableAvif && (sources as any).avif && (
        <source
          srcSet={(sources as any).avif.srcSet}
          sizes={sizes}
          type="image/avif"
        />
      )}
      
      {/* WebP format - good compression */}
      {sources.webp && (
        <source
          srcSet={sources.webp.srcSet}
          sizes={sizes}
          type="image/webp"
        />
      )}
      
      {/* JPEG fallback - universal support */}
      <source
        srcSet={sources.fallback.srcSet}
        sizes={sizes}
        type="image/jpeg"
      />
      
      {/* Fallback img element */}
      <img
        src={sources.fallback.src}
        alt={alt}
        width={width}
        height={height}
        loading={imageLoading}
        className="w-full h-auto object-cover"
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ 
          aspectRatio: width && height ? `${width}/${height}` : undefined
        }}
      />
    </picture>
  );
};

export default OptimizedImage;