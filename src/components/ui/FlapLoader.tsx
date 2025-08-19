import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface FlapLoaderProps {
  isDoneLoading: boolean;
  message?: string;
}

const FlapLoader: React.FC<FlapLoaderProps> = ({ 
  isDoneLoading, 
  message = 'Loading...' 
}) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isDoneLoading) {
      // Show the checkmark after the flaps start opening
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 600); // Delay to sync with flap animation

      return () => clearTimeout(timer);
    }
  }, [isDoneLoading]);

  return (
    <div className="flap-loader-container">
      <div className={`flap-loader-box ${isDoneLoading ? 'open' : ''}`}>
        {/* Top Flap */}
        <div className="flap flap-top"></div>
        
        {/* Bottom Flap */}
        <div className="flap flap-bottom"></div>
        
        {/* Left Flap */}
        <div className="flap flap-left"></div>
        
        {/* Right Flap */}
        <div className="flap flap-right"></div>
        
        {/* Center Content */}
        <div className={`flap-center ${showContent ? 'show' : ''}`}>
          <CheckCircle size={48} className="text-green-600" />
          <p className="text-gray-700 font-medium mt-2">Ready!</p>
        </div>
      </div>
      
      {!isDoneLoading && (
        <p className="text-gray-600 text-lg font-medium mt-6">{message}</p>
      )}
    </div>
  );
};

export default FlapLoader;