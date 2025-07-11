import React from 'react';
import LazyImage from './LazyImage';
import { generateResponsiveImageSources, generateSizesAttribute } from '../../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  sizes?: {
    [key: string]: string;
  };
  quality?: number;
  responsiveSizes?: number[];
}

/**
 * OptimizedImage component that automatically generates responsive images
 * and WebP sources for better performance
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  sizes,
  quality = 80,
  responsiveSizes = [400, 800, 1200, 1600]
}) => {
  // Generate responsive image sources
  const imageSources = generateResponsiveImageSources(src, {
    sizes: responsiveSizes,
    formats: ['webp', 'jpeg'],
    quality
  });

  // Generate sizes attribute
  const sizesAttribute = sizes ? generateSizesAttribute(sizes) : undefined;

  // Use eager loading for priority images
  const imageLoading = priority ? 'eager' : loading;

  return (
    <LazyImage
      src={imageSources.fallback.src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={imageLoading}
      sizes={sizesAttribute}
      srcSet={imageSources.fallback.srcSet}
      webpSrc={imageSources.webp?.src}
      webpSrcSet={imageSources.webp?.srcSet}
    />
  );
};

export default OptimizedImage;