import React from 'react';
import { useState } from 'react';
import { generateResponsiveImageSources, getOptimalQuality } from '../../utils/imageOptimization';
import LoadingSpinner from './LoadingSpinner';

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
  focusX?: number;
  focusY?: number;
  /** Shown automatically if the primary src fails to load */
  fallbackSrc?: string;
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
  focusX = 50,
  focusY = 50,
  fallbackSrc,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);

  // Use eager loading for priority images
  const imageLoading = priority ? 'eager' : loading;
  
  // Get optimal quality if not specified
  const optimalQuality = quality || getOptimalQuality(imageType, 'webp');
  
  // Generate responsive image sources
  const sources = generateResponsiveImageSources(activeSrc, {
    sizes: [320, 640, 960, 1280, 1600],
    formats: ['webp', 'jpeg'],
    quality: optimalQuality,
    enableAvif
  });

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      // Try the fallback image before giving up
      setActiveSrc(fallbackSrc);
      setIsLoading(true);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded z-10">
          <LoadingSpinner size="md" className="text-blue-600" />
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center bg-gray-100 rounded h-full min-h-[200px]">
          <p className="text-gray-400 text-sm">Failed to load image</p>
        </div>
      ) : (
        <picture>
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
        className={`w-full h-auto object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          aspectRatio: width && height ? `${width}/${height}` : undefined,
          objectPosition: `${focusX}% ${focusY}%`
        }}
      />
        </picture>
      )}
    </div>
  );
};

export default OptimizedImage;