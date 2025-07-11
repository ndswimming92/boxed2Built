import React from 'react';

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  lines?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  className = '',
  showImage = true,
  lines = 3
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden animate-pulse ${className}`}>
      {showImage && (
        <div className="h-48 bg-gray-200"></div>
      )}
      <div className="p-6">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        {Array.from({ length: lines }).map((_, index) => (
          <div 
            key={index}
            className={`h-4 bg-gray-200 rounded mb-2 ${
              index === lines - 1 ? 'w-3/4' : 'w-full'
            }`}
          ></div>
        ))}
        <div className="flex space-x-2 mt-4">
          <div className="h-8 bg-gray-200 rounded w-20"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;