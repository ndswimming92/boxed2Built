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
    
    // Check if it's a Pexels URL for proper optimization
    if (!baseUrl.includes('pexels.com')) {
      return baseUrl;
    }
    
    // Extract base URL without query parameters for Pexels images
    const urlParts = baseUrl.split('?');
    const baseImageUrl = urlParts[0];
    
    // Generate different sizes for responsive images
    const sizes = [
      { width: 320, height: 213, descriptor: '320w' },
      { width: 480, height: 320, descriptor: '480w' },
      { width: 768, height: 512, descriptor: '768w' },
      { width: 1024, height: 683, descriptor: '1024w' },
      { width: 1280, height: 853, descriptor: '1280w' }
    ];

    return sizes
      .map(size => {
        const format = isWebP ? 'webp' : 'jpeg';
        const quality = size.width <= 480 ? 85 : 80; // Higher quality for smaller images
        const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${size.width}&h=${size.height}&dpr=1&fm=${format}&q=${quality}`;
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
      params.set('q', '80');
      return `${baseUrl}?${params.toString()}`;
    }
    
    return null;
  };

  const webpSource = getWebPSrc();
  const responsiveSrcSet = generateSrcSet(src);
  const responsiveWebPSrcSet = webpSource ? generateSrcSet(webpSource, true) : null;

  // Improved default sizes for better performance
  const defaultSizes = sizes || '(max-width: 320px) 280px, (max-width: 480px) 440px, (max-width: 768px) 728px, (max-width: 1024px) 50vw, 33vw';

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
            style={{ 
              aspectRatio: width && height ? `${width}/${height}` : undefined,
              width: width ? `${width}px` : undefined,
              height: height ? `${height}px` : undefined
            }}
          />
        </picture>
      )}
    </div>
  );
};

export default LazyImage;