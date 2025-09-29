// Theme utility functions for accessibility and performance

export type ColorScheme = 'light' | 'dark';

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if user prefers high contrast
 */
export const prefersHighContrast = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};

/**
 * Get system color scheme preference
 */
export const getSystemColorScheme = (): ColorScheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Calculate color contrast ratio between two colors
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    // Simple luminance calculation for hex colors
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const sRGB = [r, g, b].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Check if color combination meets WCAG contrast requirements
 */
export const meetsContrastRequirement = (
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7;
  }
  
  return size === 'large' ? ratio >= 3 : ratio >= 4.5;
};

/**
 * Apply theme with smooth transition
 */
export const applyThemeWithTransition = (isDark: boolean, callback?: () => void) => {
  if (prefersReducedMotion()) {
    // Skip transition for users who prefer reduced motion
    if (callback) callback();
    return;
  }

  // Add transitioning class to prevent flash
  document.documentElement.classList.add('theme-transitioning');
  
  // Apply theme change
  if (callback) callback();
  
  // Remove transitioning class after a short delay
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning');
  }, 50);
};

/**
 * Get appropriate focus ring color for current theme
 */
export const getFocusRingColor = (isDark: boolean): string => {
  return isDark ? 'focus:ring-blue-400' : 'focus:ring-blue-500';
};

/**
 * Generate theme-aware CSS classes
 */
export const getThemeClasses = (isDark: boolean) => {
  return {
    background: isDark ? 'bg-gray-900' : 'bg-white',
    backgroundSecondary: isDark ? 'bg-gray-800' : 'bg-gray-50',
    backgroundTertiary: isDark ? 'bg-gray-700' : 'bg-gray-100',
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-600',
    textTertiary: isDark ? 'text-gray-400' : 'text-gray-500',
    border: isDark ? 'border-gray-600' : 'border-gray-200',
    borderSecondary: isDark ? 'border-gray-500' : 'border-gray-300',
    shadow: isDark ? 'shadow-2xl' : 'shadow-lg',
    focusRing: getFocusRingColor(isDark),
  };
};

/**
 * Initialize theme system with proper accessibility considerations
 */
export const initializeThemeSystem = () => {
  // Set color scheme meta tag for browser UI
  const setColorSchemeMeta = (scheme: ColorScheme) => {
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', scheme);
  };

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = (e: MediaQueryListEvent) => {
    setColorSchemeMeta(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handleSystemChange);
  
  // Set initial color scheme
  setColorSchemeMeta(getSystemColorScheme());

  return () => {
    mediaQuery.removeEventListener('change', handleSystemChange);
  };
};

/**
 * Validate theme colors for accessibility
 */
export const validateThemeColors = () => {
  const colors = {
    light: {
      background: '#ffffff',
      text: '#111827',
      primary: '#1d4ed8',
      secondary: '#059669'
    },
    dark: {
      background: '#111827',
      text: '#f3f4f6',
      primary: '#60a5fa',
      secondary: '#4ade80'
    }
  };

  const results = {
    light: {
      textOnBackground: meetsContrastRequirement(colors.light.text, colors.light.background),
      primaryOnBackground: meetsContrastRequirement(colors.light.primary, colors.light.background),
      secondaryOnBackground: meetsContrastRequirement(colors.light.secondary, colors.light.background)
    },
    dark: {
      textOnBackground: meetsContrastRequirement(colors.dark.text, colors.dark.background),
      primaryOnBackground: meetsContrastRequirement(colors.dark.primary, colors.dark.background),
      secondaryOnBackground: meetsContrastRequirement(colors.dark.secondary, colors.dark.background)
    }
  };

  return results;
};