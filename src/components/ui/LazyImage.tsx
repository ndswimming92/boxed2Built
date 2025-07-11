import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  srcSet?: string;
  webpSrc?: string;
  webpSrcSet?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  sizes,
  srcSet,
  webpSrc,
  webpSrcSet
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Generate responsive srcSet from base URL if not provided
  const generateSrcSet = (baseUrl: string, isWebP: boolean = false) => {
    if (srcSet || webpSrcSet) return isWebP ? webpSrcSet : srcSet;
    
    // Extract base URL without query parameters for Pexels images
    const urlParts = baseUrl.split('?');
    const baseImageUrl = urlParts[0];
    const queryParams = urlParts[1] || '';
    
    // Generate different sizes for responsive images
    const sizes = [
      { width: 400, descriptor: '400w' },
      { width: 800, descriptor: '800w' },
      { width: 1200, descriptor: '1200w' },
      { width: 1600, descriptor: '1600w' }
    ];

    return sizes
      .map(size => {
        const format = isWebP ? 'webp' : 'jpeg';
        const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${size.width}&h=${Math.round(size.width * 0.67)}&dpr=1&fm=${format}`;
        return `${url} ${size.descriptor}`;
      })
      .join(', ');
  };

  // Generate WebP source URL if not provided
  const getWebPSrc = () => {
    if (webpSrc) return webpSrc;
    
    // Convert regular image URL to WebP for Pexels
    if (src.includes('pexels.com')) {
      const urlParts = src.split('?');
      const baseUrl = urlParts[0];
      const params = new URLSearchParams(urlParts[1] || '');
      params.set('fm', 'webp');
      return `${baseUrl}?${params.toString()}`;
    }
    
    return null;
  };

  const webpSource = getWebPSrc();
  const responsiveSrcSet = generateSrcSet(src);
  const responsiveWebPSrcSet = webpSource ? generateSrcSet(webpSource, true) : null;

  // Default sizes if not provided
  const defaultSizes = sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded z-10">
          <LoadingSpinner size="md" className="text-gray-400" />
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center bg-gray-100 rounded h-full min-h-[200px]">
          <p className="text-gray-400 text-sm">Failed to load image</p>
        </div>
      ) : (
        <picture>
          {/* WebP source with responsive images */}
          {responsiveWebPSrcSet && (
            <source
              srcSet={responsiveWebPSrcSet}
              sizes={defaultSizes}
              type="image/webp"
            />
          )}
          
          {/* Fallback source with responsive images */}
          <source
            srcSet={responsiveSrcSet}
            sizes={defaultSizes}
            type="image/jpeg"
          />
          
          {/* Fallback img element */}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            onLoad={handleLoad}
            onError={handleError}
            className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 w-full h-auto`}
            style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
          />
        </picture>
      )}
    </div>
  );
};

export default LazyImage;