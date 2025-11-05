import React from 'react';
import { Star } from 'lucide-react';
import { getStarFillPercentage } from '../../utils/ratingCalculations';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  className?: string;
  showNumber?: boolean;
  showDecimal?: boolean;
  allowPartialStars?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 20,
  className = '',
  showNumber = false,
  showDecimal = false,
  allowPartialStars = false
}) => {
  const renderStar = (index: number) => {
    const starPosition = index + 1;

    if (!allowPartialStars) {
      return (
        <Star
          key={index}
          size={size}
          className={`${
            index < Math.floor(rating)
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300'
          }`}
        />
      );
    }

    const fillPercentage = getStarFillPercentage(rating, starPosition);

    if (fillPercentage === 100) {
      return (
        <Star
          key={index}
          size={size}
          className="text-yellow-400 fill-current"
        />
      );
    }

    if (fillPercentage === 0) {
      return (
        <Star
          key={index}
          size={size}
          className="text-gray-300"
        />
      );
    }

    return (
      <div key={index} className="relative inline-block" style={{ width: size, height: size }}>
        <Star
          size={size}
          className="text-gray-300 absolute top-0 left-0"
        />
        <div
          className="overflow-hidden absolute top-0 left-0"
          style={{ width: `${fillPercentage}%` }}
        >
          <Star
            size={size}
            className="text-yellow-400 fill-current"
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex">
        {[...Array(maxRating)].map((_, index) => renderStar(index))}
      </div>
      {showNumber && (
        <span className="ml-2 text-sm text-gray-600">
          {showDecimal ? rating.toFixed(1) : Math.round(rating)}/{maxRating}
        </span>
      )}
    </div>
  );
};

export default StarRating;