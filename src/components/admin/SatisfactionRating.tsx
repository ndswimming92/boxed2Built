import React, { useState } from 'react';
import { Star } from 'lucide-react';

type SatisfactionRatingProps = {
  rating: number;
  comment: string;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
};

export default function SatisfactionRating({
  rating,
  comment,
  onRatingChange,
  onCommentChange,
}: SatisfactionRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const displayRating = hoveredStar !== null ? hoveredStar : rating;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          How satisfied was the customer with the work?
        </label>
        <div className="flex gap-2 items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={`w-12 h-12 transition-colors ${
                  star <= displayRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-300'
                }`}
              />
            </button>
          ))}
          <span className="ml-4 text-3xl font-bold text-slate-900">
            {displayRating}/5
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Click a star to rate (1 = Poor, 5 = Excellent)
        </p>
      </div>

      <div>
        <label htmlFor="satisfaction-comment" className="block text-sm font-semibold text-slate-900 mb-2">
          Customer Feedback (Optional)
        </label>
        <textarea
          id="satisfaction-comment"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={4}
          placeholder="Any comments or feedback from the customer..."
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 placeholder-slate-400 resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">
          This will be saved as a customer review if provided
        </p>
      </div>

      {rating > 0 && (
        <div className={`p-4 rounded-lg border-2 ${
          rating >= 4
            ? 'bg-emerald-50 border-emerald-200'
            : rating === 3
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            rating >= 4
              ? 'text-emerald-900'
              : rating === 3
              ? 'text-yellow-900'
              : 'text-red-900'
          }`}>
            {rating >= 4
              ? 'Great! Customer is satisfied with the work.'
              : rating === 3
              ? 'Customer is moderately satisfied. Consider follow-up.'
              : 'Customer satisfaction is low. Follow-up recommended.'}
          </p>
        </div>
      )}
    </div>
  );
}
