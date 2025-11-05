import { CustomerReview } from '../lib/supabase';

export interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingPercentage: number;
  distribution: { [key: number]: number };
  minRating: number;
  maxRating: number;
}

export function calculateAverageRating(reviews: CustomerReview[]): number {
  if (!reviews || reviews.length === 0) return 0;

  const totalRating = reviews.reduce((sum, review) => sum + review.rating_value, 0);
  return totalRating / reviews.length;
}

export function calculateRatingPercentage(reviews: CustomerReview[], maxRating: number = 5): number {
  if (!reviews || reviews.length === 0) return 0;

  const totalPossibleRating = reviews.length * maxRating;
  const totalActualRating = reviews.reduce((sum, review) => sum + review.rating_value, 0);

  return (totalActualRating / totalPossibleRating) * 100;
}

export function calculateRatingStats(reviews: CustomerReview[]): RatingStats {
  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingPercentage: 0,
      distribution: {},
      minRating: 0,
      maxRating: 5
    };
  }

  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let minRating = 5;
  let maxRating = 1;

  reviews.forEach(review => {
    const rating = review.rating_value;
    distribution[rating] = (distribution[rating] || 0) + 1;
    minRating = Math.min(minRating, rating);
    maxRating = Math.max(maxRating, rating);
  });

  return {
    averageRating: calculateAverageRating(reviews),
    totalReviews: reviews.length,
    ratingPercentage: calculateRatingPercentage(reviews),
    distribution,
    minRating,
    maxRating
  };
}

export function formatRating(rating: number, decimalPlaces: number = 1): string {
  return rating.toFixed(decimalPlaces);
}

export function getStarFillPercentage(rating: number, starPosition: number): number {
  if (starPosition <= Math.floor(rating)) {
    return 100;
  }

  if (starPosition === Math.ceil(rating)) {
    const remainder = rating - Math.floor(rating);
    return remainder * 100;
  }

  return 0;
}
