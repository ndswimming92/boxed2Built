// Font optimization utilities

export interface FontPreloadOptions {
  href: string;
  type?: string;
  crossorigin?: boolean;
  media?: string;
}

/**
 * Preload critical fonts for better performance
 */
export const preloadFont = (options: FontPreloadOptions): void => {
  const {
    href,
    type = 'font/woff2',
    crossorigin = true,
    media
  } = options;

  // Check if font is already preloaded
  const existingLink = document.querySelector(`link[href="${href}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.href = href;
  link.type = type;
  
  if (crossorigin) {
    link.crossOrigin = 'anonymous';
  }
  
  if (media) {
    link.media = media;
  }

  document.head.appendChild(link);
};

/**
 * Preload all critical fonts
 */
export const preloadCriticalFonts = (): void => {
  const criticalFonts = [
    { href: '/fonts/inter-regular.woff2' },
    { href: '/fonts/inter-medium.woff2' },
    { href: '/fonts/inter-semibold.woff2' },
    { href: '/fonts/inter-bold.woff2' }
  ];

  criticalFonts.forEach(preloadFont);
};

/**
 * Check if fonts are loaded and apply fallback if needed
 */
export const checkFontLoading = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!('fonts' in document)) {
      resolve(false);
      return;
    }

    // Check if Inter font is available
    document.fonts.ready.then(() => {
      const interFont = new FontFace('Inter', 'url(/fonts/inter-regular.woff2)');
      
      interFont.load().then(() => {
        document.fonts.add(interFont);
        resolve(true);
      }).catch(() => {
        resolve(false);
      });
    });

    // Timeout after 3 seconds
    setTimeout(() => resolve(false), 3000);
  });
};

/**
 * Apply font optimization classes to body
 */
export const applyFontOptimizations = (): void => {
  document.body.classList.add('font-feature-settings');
  
  // Add font-display: swap fallback for older browsers
  const style = document.createElement('style');
  style.textContent = `
    @supports not (font-display: swap) {
      @font-face {
        font-family: 'Inter-fallback';
        src: local('Arial'), local('Helvetica'), local('sans-serif');
        font-display: block;
      }
    }
  `;
  document.head.appendChild(style);
};

/**
 * Initialize font optimization
 */
export const initializeFontOptimization = (): void => {
  // Apply optimizations immediately
  applyFontOptimizations();
  
  // Preload critical fonts if not already done in HTML
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadCriticalFonts);
  } else {
    preloadCriticalFonts();
  }
  
  // Check font loading status
  checkFontLoading().then((loaded) => {
    if (loaded) {
      console.log('✅ Custom fonts loaded successfully');
    } else {
      console.log('⚠️ Custom fonts failed to load, using system fallbacks');
    }
  });
};