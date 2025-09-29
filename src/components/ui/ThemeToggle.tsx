import React, { useState, useRef } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useDarkMode, Theme } from '../../hooks/useDarkMode';
import { trackEvent } from '../../utils/analytics';

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <Sun size={16} />,
    description: 'Light theme'
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon size={16} />,
    description: 'Dark theme'
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor size={16} />,
    description: 'Follow system preference'
  }
];

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'button' | 'dropdown';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '',
  showLabel = false,
  variant = 'button'
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
    trackEvent('theme-change', newTheme, {
      event_category: 'ui_interaction',
      user_engagement: 'theme_change'
    });
  };

  const handleToggle = () => {
    toggleTheme();
    trackEvent('theme-toggle', isDark ? 'light' : 'dark', {
      event_category: 'ui_interaction',
      user_engagement: 'theme_toggle'
    });
  };

  const currentOption = themeOptions.find(option => option.value === theme) || themeOptions[0];

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        className={`
          inline-flex items-center justify-center p-2 rounded-lg
          bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
          text-gray-700 dark:text-gray-300
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-900
          ${className}
        `}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      >
        <div className="relative w-5 h-5">
          <Sun 
            size={20} 
            className={`
              absolute inset-0 transition-all duration-300 ease-in-out
              ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
            `}
          />
          <Moon 
            size={20} 
            className={`
              absolute inset-0 transition-all duration-300 ease-in-out
              ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
            `}
          />
        </div>
        {showLabel && (
          <span className="ml-2 text-sm font-medium">
            {isDark ? 'Dark' : 'Light'}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center justify-center p-2 rounded-lg
          bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
          text-gray-700 dark:text-gray-300
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-900
        `}
        aria-label="Theme selector"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {currentOption.icon}
        {showLabel && (
          <span className="ml-2 text-sm font-medium">
            {currentOption.label}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 z-20">
            <div className="
              bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700
              rounded-lg shadow-lg
              py-1
              animate-fadeIn
            ">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value)}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    text-gray-700 dark:text-gray-300
                    transition-colors duration-150
                    ${theme === option.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : ''}
                  `}
                  role="menuitem"
                  aria-label={option.description}
                >
                  <span className="mr-3">
                    {option.icon}
                  </span>
                  <span className="flex-1 text-left">
                    {option.label}
                  </span>
                  {theme === option.value && (
                    <Check size={16} className="text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeToggle;