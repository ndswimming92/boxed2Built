import React, { useEffect, useState } from 'react';
import { checkFontLoading } from '../../utils/fontOptimization';

interface FontLoaderProps {
  children: React.ReactNode;
  fallbackClassName?: string;
}

/**
 * FontLoader component that handles font loading states
 * and applies appropriate classes based on font availability
 */
const FontLoader: React.FC<FontLoaderProps> = ({ 
  children, 
  fallbackClassName = 'font-system' 
}) => {
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontFailed, setFontFailed] = useState(false);

  useEffect(() => {
    checkFontLoading().then((loaded) => {
      if (loaded) {
        setFontLoaded(true);
      } else {
        setFontFailed(true);
      }
    });
  }, []);

  // Apply appropriate classes based on font loading state
  const className = fontFailed ? fallbackClassName : '';

  return (
    <div className={className} data-font-loaded={fontLoaded}>
      {children}
    </div>
  );
};

export default FontLoader;