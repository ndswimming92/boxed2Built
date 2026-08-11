// Type-only so this module carries no runtime import: the Vite build plugin that
// fills the review totals in index.html imports isRatingOnly from here, and
// pulling in lib/supabase would construct a Supabase client at config load.
import type { CustomerReview } from '../lib/supabase';

/** Anything with a `review_body` — lets these helpers run against the DB row,
 *  the SSG fallback shape, or a mapped view model. */
type RatingLike = Pick<CustomerReview, 'review_body'>;

export interface RatingStats {
  averageRating: number;
  /** Every rating, including star-only ones. Matches the count Google shows. */
  totalReviews: number;
  /** Ratings that came with written text — the only ones that can be displayed. */
  writtenReviews: number;
  /** Star-only ratings: they count, but there is nothing to render or quote. */
  ratingOnlyReviews: number;
  ratingPercentage: number;
  distribution: { [key: number]: number };
  minRating: number;
  maxRating: number;
}

/**
 * True when a rating was left without any written text. Google Business Profile
 * lets customers post a star rating on its own, and those still count toward the
 * profile's review total — but they have no body to put in a testimonial card or
 * a schema.org Review node.
 */
export function isRatingOnly(review: RatingLike): boolean {
  return !review.review_body || review.review_body.trim().length === 0;
}

/**
 * The subset that can actually be shown to a visitor. Use this anywhere a review
 * is rendered or emitted as a `Review` node; use the full list for the counts and
 * the average, which include star-only ratings.
 */
export function getWrittenReviews<T extends RatingLike>(reviews: T[] | null | undefined): T[] {
  return (reviews ?? []).filter((review) => !isRatingOnly(review));
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
      writtenReviews: 0,
      ratingOnlyReviews: 0,
      ratingPercentage: 0,
      distribution: {},
      minRating: 0,
      maxRating: 5
    };
  }

  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let minRating = 5;
  let maxRating = 1;
  let writtenReviews = 0;

  reviews.forEach(review => {
    const rating = review.rating_value;
    distribution[rating] = (distribution[rating] || 0) + 1;
    minRating = Math.min(minRating, rating);
    maxRating = Math.max(maxRating, rating);
    if (!isRatingOnly(review)) writtenReviews += 1;
  });

  return {
    averageRating: calculateAverageRating(reviews),
    totalReviews: reviews.length,
    writtenReviews,
    ratingOnlyReviews: reviews.length - writtenReviews,
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
