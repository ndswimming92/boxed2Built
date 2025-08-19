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
        {/* Box Base and Walls */}
        <div className="box-bottom"></div>
        <div className="box-wall box-wall-front"></div>
        <div className="box-wall box-wall-back"></div>
        <div className="box-wall box-wall-left"></div>
        <div className="box-wall box-wall-right"></div>
        
        {/* Top Flaps */}
        <div className="flap flap-top-front"></div>
        <div className="flap flap-top-back"></div>
        <div className="flap flap-top-left"></div>
        <div className="flap flap-top-right"></div>
        
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