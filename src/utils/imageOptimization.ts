// Image optimization utilities

export interface ResponsiveImageConfig {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export interface ResponsiveImageSources {
  webp?: {
    src: string;
    srcSet: string;
  };
  fallback: {
    src: string;
    srcSet: string;
  };
}

/**
 * Generate responsive image sources for different formats and sizes
 */
export const generateResponsiveImageSources = (
  baseUrl: string,
  options: {
    sizes?: number[];
    formats?: ('webp' | 'jpeg' | 'png')[];
    quality?: number;
  } = {}
): ResponsiveImageSources => {
  const {
    sizes = [400, 800, 1200, 1600],
    formats = ['webp', 'jpeg'],
    quality = 80
  } = options;

  const sources: ResponsiveImageSources = {
    fallback: {
      src: baseUrl,
      srcSet: ''
    }
  };

  // Check if it's a Pexels URL for special handling
  const isPexelsUrl = baseUrl.includes('pexels.com');
  
  if (isPexelsUrl) {
    // Generate Pexels-specific responsive images
    const urlParts = baseUrl.split('?');
    const baseImageUrl = urlParts[0];
    
    // Generate WebP sources
    if (formats.includes('webp')) {
      const webpSrcSet = sizes
        .map(width => {
          const height = Math.round(width * 0.67); // Maintain aspect ratio
          const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&dpr=1&fm=webp&q=${quality}`;
          return `${url} ${width}w`;
        })
        .join(', ');
      
      sources.webp = {
        src: `${baseImageUrl}?auto=compress&cs=tinysrgb&w=800&h=533&dpr=1&fm=webp&q=${quality}`,
        srcSet: webpSrcSet
      };
    }
    
    // Generate JPEG fallback sources
    const jpegSrcSet = sizes
      .map(width => {
        const height = Math.round(width * 0.67);
        const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&dpr=1&fm=jpg&q=${quality}`;
        return `${url} ${width}w`;
      })
      .join(', ');
    
    sources.fallback = {
      src: `${baseImageUrl}?auto=compress&cs=tinysrgb&w=800&h=533&dpr=1&fm=jpg&q=${quality}`,
      srcSet: jpegSrcSet
    };
  } else {
    // For non-Pexels URLs, use the original URL as fallback
    sources.fallback = {
      src: baseUrl,
      srcSet: baseUrl
    };
  }

  return sources;
};

/**
 * Generate sizes attribute for responsive images
 */
export const generateSizesAttribute = (breakpoints: {
  [key: string]: string;
}): string => {
  const defaultBreakpoints = {
    '(max-width: 640px)': '100vw',
    '(max-width: 1024px)': '50vw',
    '(max-width: 1280px)': '33vw',
    default: '25vw'
  };

  const merged = { ...defaultBreakpoints, ...breakpoints };
  
  const sizesArray = Object.entries(merged)
    .filter(([key]) => key !== 'default')
    .map(([query, size]) => `${query} ${size}`);
  
  // Add default size at the end
  sizesArray.push(merged.default);
  
  return sizesArray.join(', ');
};

/**
 * Preload critical images for better performance
 */
export const preloadImage = (src: string, options: {
  as?: 'image';
  type?: string;
  media?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
} = {}) => {
  const {
    as = 'image',
    type,
    media,
    fetchPriority = 'high'
  } = options;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  
  if (type) link.type = type;
  if (media) link.media = media;
  if (fetchPriority) link.setAttribute('fetchpriority', fetchPriority);
  
  document.head.appendChild(link);
};

/**
 * Check if WebP is supported by the browser
 */
export const isWebPSupported = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};