import React from 'react';
import { Quote } from 'lucide-react';
import StarRating from './ui/StarRating';
import { Review } from '../constants/reviews';

interface ReviewCardProps {
  review: Review;
  className?: string;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300 ${className}`}>
      <div className="flex items-start mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
          <Quote className="text-blue-600" size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{review.author}</h3>
            <div className="flex items-center">
              <StarRating rating={review.rating} size={16} />
              <span className="ml-2 text-sm text-gray-500">{review.source}</span>
            </div>
          </div>
        </div>
      </div>
      
      <blockquote className="text-gray-700 leading-relaxed italic">
        "{review.text}"
      </blockquote>
    </div>
  );
};

export default ReviewCard;