import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  className?: string;
  showRatingText?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 20,
  className = '',
  showRatingText = false
}) => {
  const stars = [];
  
  for (let i = 1; i <= maxRating; i++) {
    stars.push(
      <Star
        key={i}
        size={size}
        className={`${
          i <= rating 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300'
        } ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex items-center">
      <div className="flex" role="img" aria-label={`${rating} out of ${maxRating} stars`}>
        {stars}
      </div>
      {showRatingText && (
        <span className="ml-2 text-sm text-gray-600">
          {rating}.0 out of {maxRating}
        </span>
      )}
    </div>
  );
};

export default StarRating;