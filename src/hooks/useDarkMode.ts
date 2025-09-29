import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface UseDarkModeReturn {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useDarkMode = (): UseDarkModeReturn => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // Get system preference
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // Calculate if dark mode should be active
  const calculateIsDark = (currentTheme: Theme): boolean => {
    if (currentTheme === 'system') {
      return getSystemPreference();
    }
    return currentTheme === 'dark';
  };

  // Apply theme to document
  const applyTheme = (newTheme: Theme) => {
    const shouldBeDark = calculateIsDark(newTheme);
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    setIsDark(shouldBeDark);
  };

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme-preference', newTheme);
    applyTheme(newTheme);
  };

  // Toggle between light and dark (not system)
  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Initialize theme on mount
  useEffect(() => {
    // Get stored preference or default to system
    const storedTheme = localStorage.getItem('theme-preference') as Theme;
    const initialTheme = storedTheme || 'system';
    
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  // Update when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  };
};