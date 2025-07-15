import React, { useState, useEffect } from 'react';

const ScrollProgressBar: React.FC = () => {
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const calculateScrollPercentage = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (scrollHeight === 0) {
        setScrollPercentage(0);
        return;
      }
      
      const percentage = (scrollTop / scrollHeight) * 100;
      setScrollPercentage(Math.min(100, Math.max(0, percentage)));
    };

    // Calculate initial scroll percentage
    calculateScrollPercentage();

    // Throttle scroll events for better performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          calculateScrollPercentage();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', calculateScrollPercentage, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', calculateScrollPercentage);
    };
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 bg-opacity-50">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-150 ease-out shadow-sm"
        style={{ width: `${scrollPercentage}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Page scroll progress: ${Math.round(scrollPercentage)}%`}
      />
      
      {/* Optional: Show percentage text on hover */}
      {scrollPercentage > 0 && (
        <div 
          className="absolute right-2 -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{ 
            transform: 'translateX(-50%)',
            left: `${scrollPercentage}%`
          }}
        >
          {Math.round(scrollPercentage)}%
        </div>
      )}
    </div>
  );
};

export default ScrollProgressBar;