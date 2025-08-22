import React, { useState } from 'react';
import { generateOptimizedImageUrl, getOptimalQuality } from '../../utils/imageOptimization';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  imageType?: 'hero' | 'thumbnail' | 'gallery' | 'icon';
  quality?: number;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  imageType = 'gallery',
  quality
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Get optimal quality and generate optimized URL
  const optimalQuality = quality || getOptimalQuality(imageType, 'webp');
  const optimizedSrc = generateOptimizedImageUrl(src, {
    width,
    height,
    quality: optimalQuality,
    imageType,
    format: 'auto'
  });

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Use eager loading for priority images
  const imageLoading = priority ? 'eager' : loading;

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded z-10">
          <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center bg-gray-100 rounded h-full min-h-[200px]">
          <p className="text-gray-400 text-sm">Failed to load image</p>
        </div>
      ) : (
        <picture>
          {/* Modern browsers get optimized formats */}
          <source
            srcSet={generateOptimizedImageUrl(src, { width, height, format: 'avif', quality: optimalQuality, imageType })}
            type="image/avif"
          />
          <source
            srcSet={generateOptimizedImageUrl(src, { width, height, format: 'webp', quality: optimalQuality, imageType })}
            type="image/webp"
          />
          
          {/* Fallback */}
          <img
            src={optimizedSrc}
            alt={alt}
            width={width}
            height={height}
            loading={imageLoading}
            onLoad={handleLoad}
            onError={handleError}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 w-full h-auto object-cover`}
            style={{ 
              aspectRatio: width && height ? `${width}/${height}` : undefined
            }}
          />
        </picture>
      )}
    </div>
  );
};

export default LazyImage;