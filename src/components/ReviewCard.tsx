import React from 'react';
import { Quote, BadgeCheck } from 'lucide-react';
import StarRating from './ui/StarRating';
import { Review } from '../types';
import { trackEvent } from '../utils/analytics';

interface ReviewCardProps {
  review: Review;
  /** Center card in the carousel gets a stronger elevation. */
  elevated?: boolean;
  className?: string;
}

// Avatar tints map to the brand's soft category surfaces.
const AVATAR_TINTS: Record<NonNullable<Review['tint']>, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  emerald: 'bg-emerald-50 text-emerald-700',
};

const ReviewCard: React.FC<ReviewCardProps> = ({ review, elevated = false, className = '' }) => {
  const handleGoogleLinkClick = () => {
    trackEvent('google-review-card-click');
  };

  const isVerified = review.source === 'Google';
  const avatarTint = AVATAR_TINTS[review.tint ?? 'blue'] ?? AVATAR_TINTS.blue;
  const initials =
    review.initials ??
    review.author
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-7 py-8 sm:px-8 transition-shadow duration-300 ${
        elevated ? 'shadow-xl' : 'shadow-sm'
      } ${className}`}
    >
      {/* Faint watermark quote mark */}
      <Quote
        className="pointer-events-none absolute left-6 top-5 text-blue-600 opacity-[0.08]"
        size={56}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarTint}`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <div className="text-base font-bold text-gray-900">{review.author}</div>
            {isVerified ? (
              review.googleReviewUrl ? (
                <a
                  href={review.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer ugc"
                  onClick={handleGoogleLinkClick}
                  className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gray-600 no-underline transition-colors hover:text-blue-700"
                  aria-label={`View ${review.author}'s review on Google`}
                >
                  <BadgeCheck className="text-blue-600" size={14} />
                  Verified on Google
                </a>
              ) : (
                <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gray-600">
                  <BadgeCheck className="text-blue-600" size={14} />
                  Verified on Google
                </span>
              )
            ) : (
              <span className="mt-0.5 block text-[12.5px] text-gray-500">Customer review</span>
            )}
          </div>
        </div>
        <StarRating rating={review.rating} size={16} className="flex-shrink-0" />
      </div>

      <blockquote
        className="relative mt-4 overflow-hidden italic leading-[1.65] text-gray-700"
        style={{
          fontSize: '16.5px',
          display: '-webkit-box',
          WebkitLineClamp: 5,
          WebkitBoxOrient: 'vertical',
        }}
      >
        &ldquo;{review.text}&rdquo;
      </blockquote>
    </div>
  );
};

export default ReviewCard;
