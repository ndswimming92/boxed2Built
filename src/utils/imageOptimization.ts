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
    enableAvif?: boolean;
  } = {}
): ResponsiveImageSources => {
  const {
    sizes = [400, 800, 1200, 1600],
    formats = ['webp', 'jpeg'],
    quality = 85,
    enableAvif = true
  } = options;

  const sources: ResponsiveImageSources & { avif?: { src: string; srcSet: string } } = {
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
    
    // Generate AVIF sources (most efficient)
    if (enableAvif && formats.includes('webp')) {
      const avifSrcSet = sizes
        .map(width => {
          const height = Math.round(width * 0.67);
          const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&dpr=1&fm=avif&q=${quality}`;
          return `${url} ${width}w`;
        })
        .join(', ');
      
      sources.avif = {
        src: `${baseImageUrl}?auto=compress&cs=tinysrgb&w=800&h=533&dpr=1&fm=avif&q=${quality}`,
        srcSet: avifSrcSet
      };
    }
    
    // Generate WebP sources
    if (formats.includes('webp')) {
      const webpSrcSet = sizes
        .map(width => {
          const height = Math.round(width * 0.67); // Maintain aspect ratio
          const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&dpr=1&fm=webp&q=${Math.min(quality + 5, 95)}`;
          return `${url} ${width}w`;
        })
        .join(', ');
      
      sources.webp = {
        src: `${baseImageUrl}?auto=compress&cs=tinysrgb&w=800&h=533&dpr=1&fm=webp&q=${Math.min(quality + 5, 95)}`,
        srcSet: webpSrcSet
      };
    }
    
    // Generate JPEG fallback sources
    const jpegSrcSet = sizes
      .map(width => {
        const height = Math.round(width * 0.67);
        const url = `${baseImageUrl}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&dpr=1&fm=jpg&q=${Math.max(quality - 5, 75)}`;
        return `${url} ${width}w`;
      })
      .join(', ');
    
    sources.fallback = {
      src: `${baseImageUrl}?auto=compress&cs=tinysrgb&w=800&h=533&dpr=1&fm=jpg&q=${Math.max(quality - 5, 75)}`,
      srcSet: jpegSrcSet
    };
  } else {
    // For local images, generate optimized versions
    if (baseUrl.startsWith('/images/')) {
      // Generate AVIF sources for local images
      if (enableAvif) {
        const avifSrcSet = sizes
          .map(width => `${baseUrl}?fm=avif&q=${quality}&w=${width} ${width}w`)
          .join(', ');
        
        sources.avif = {
          src: `${baseUrl}?fm=avif&q=${quality}&w=800`,
          srcSet: avifSrcSet
        };
      }
      
      // Generate WebP sources for local images
      if (formats.includes('webp')) {
        const webpSrcSet = sizes
          .map(width => `${baseUrl}?fm=webp&q=${Math.min(quality + 5, 95)}&w=${width} ${width}w`)
          .join(', ');
        
        sources.webp = {
          src: `${baseUrl}?fm=webp&q=${Math.min(quality + 5, 95)}&w=800`,
          srcSet: webpSrcSet
        };
      }
      
      // Generate JPEG sources for local images
      const jpegSrcSet = sizes
        .map(width => `${baseUrl}?fm=jpg&q=${Math.max(quality - 5, 75)}&w=${width} ${width}w`)
        .join(', ');
      
      sources.fallback = {
        src: `${baseUrl}?fm=jpg&q=${Math.max(quality - 5, 75)}&w=800`,
        srcSet: jpegSrcSet
      };
    } else {
      // For other URLs, use the original URL as fallback
      sources.fallback = {
        src: baseUrl,
        srcSet: baseUrl
      };
    }
  }

  return sources;
};

/**
 * Get optimal image quality based on image type and use case
 */
export const getOptimalQuality = (
  imageType: 'hero' | 'thumbnail' | 'gallery' | 'icon',
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): number => {
  const qualityMatrix = {
    hero: { avif: 80, webp: 85, jpeg: 80, png: 95 },
    gallery: { avif: 75, webp: 80, jpeg: 75, png: 90 },
    thumbnail: { avif: 70, webp: 75, jpeg: 70, png: 85 },
    icon: { avif: 85, webp: 90, jpeg: 85, png: 100 }
  };
  
  return qualityMatrix[imageType][format];
};

/**
 * Generate optimized image URL with smart compression
 */
export const generateOptimizedImageUrl = (
  baseUrl: string,
  options: {
    width?: number;
    height?: number;
    format?: 'avif' | 'webp' | 'jpeg' | 'png' | 'auto';
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill';
    imageType?: 'hero' | 'thumbnail' | 'gallery' | 'icon';
  } = {}
): string => {
  const {
    width,
    height,
    format = 'auto',
    quality,
    fit = 'cover',
    imageType = 'gallery'
  } = options;

  // For Pexels URLs
  if (baseUrl.includes('pexels.com')) {
    const urlParts = baseUrl.split('?');
    const baseImageUrl = urlParts[0];
    const params = new URLSearchParams();
    
    params.set('auto', 'compress');
    params.set('cs', 'tinysrgb');
    
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    
    // Smart format selection
    if (format === 'auto') {
      // Use AVIF for modern browsers, fallback handled by picture element
      params.set('fm', 'avif');
    } else {
      params.set('fm', format);
    }
    
    // Smart quality based on format and image type
    const optimalQuality = quality || getOptimalQuality(imageType, format === 'auto' ? 'avif' : format);
    params.set('q', optimalQuality.toString());
    
    params.set('fit', fit);
    params.set('dpr', '1');
    
    return `${baseImageUrl}?${params.toString()}`;
  }
  
  // For local images (would need server-side processing)
  if (baseUrl.startsWith('/images/')) {
    const params = new URLSearchParams();
    
    if (format !== 'auto') params.set('fm', format);
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    if (quality) params.set('q', quality.toString());
    if (fit !== 'cover') params.set('fit', fit);
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  return baseUrl;
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