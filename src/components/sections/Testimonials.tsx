import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReviewCard from '../ReviewCard';
import StarRating from '../ui/StarRating';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { calculateRatingStats } from '../../utils/ratingCalculations';

const AUTOSCROLL_MS = 5000;
const RESUME_AFTER_MS = 10000;

const Testimonials: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  // Avoid stacking timeouts when user clicks multiple times
  const resumeTimeoutRef = useRef<number | null>(null);

  // Respect "reduced motion" without changing other files
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const REVIEWS =
    businessData?.reviews.map((review) => ({
      id: review.id,
      author: review.author_name,
      text: review.review_body,
      rating: review.rating_value,
      datePublished: review.date_published,
      source: review.is_verified ? 'Google' : 'Customer',
      // NOTE: You have a hard-coded URL here. Leaving it as-is because you said “no other files”.
      // If you have a real Google review link in your data later, swap to that.
      googleReviewUrl: review.is_verified
        ? 'https://www.google.com/maps/place/Boxed2Built/@35.7513,-86.9236,17z/data=!4m8!3m7!1s0x886466e6e6e6e6e6:0x1234567890abcdef!8m2!3d35.7513!4d-86.9236!9m1!1b1!16s%2Fg%2F11y3qr8h5z'
        : undefined,
    })) || [];

  const ratingStats = useMemo(() => {
    if (!businessData?.reviews) return null;
    return calculateRatingStats(businessData.reviews);
  }, [businessData?.reviews]);

  // If reviews length changes, keep index valid
  useEffect(() => {
    if (currentIndex >= REVIEWS.length && REVIEWS.length > 0) {
      setCurrentIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [REVIEWS.length]);

  // Pause auto-scroll when tab hidden (prevents surprise jumps)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsAutoScrolling(false);
      } else if (!prefersReducedMotion) {
        // Resume when returning
        setIsAutoScrolling(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [prefersReducedMotion]);

  // Auto-scroll (disabled for reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!isAutoScrolling || REVIEWS.length === 0) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev === REVIEWS.length - 1 ? 0 : prev + 1));
    }, AUTOSCROLL_MS);

    return () => window.clearInterval(interval);
  }, [isAutoScrolling, REVIEWS.length, prefersReducedMotion]);

  // Keyboard navigation (great accessibility win)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (REVIEWS.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, REVIEWS.length]);

  const clearResumeTimeout = () => {
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  };

  // Pause auto-scroll when user interacts; resume after inactivity (without stacking timers)
  const handleManualNavigation = (newIndex: number) => {
    setCurrentIndex(newIndex);

    if (!prefersReducedMotion) {
      setIsAutoScrolling(false);
      clearResumeTimeout();
      resumeTimeoutRef.current = window.setTimeout(() => {
        setIsAutoScrolling(true);
      }, RESUME_AFTER_MS);
    }
  };

  const goToPrevious = () => {
    if (REVIEWS.length === 0) return;
    const newIndex = currentIndex === 0 ? REVIEWS.length - 1 : currentIndex - 1;
    handleManualNavigation(newIndex);
  };

  const goToNext = () => {
    if (REVIEWS.length === 0) return;
    const newIndex = currentIndex === REVIEWS.length - 1 ? 0 : currentIndex + 1;
    handleManualNavigation(newIndex);
  };

  const goToSlide = (index: number) => {
    handleManualNavigation(index);
  };

  const firstGoogleUrl = useMemo(() => {
    return REVIEWS.find((r) => r.googleReviewUrl)?.googleReviewUrl;
  }, [REVIEWS]);

  if (loading) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-64 mx-auto mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-96 mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (REVIEWS.length === 0) return null;

  const showNav = REVIEWS.length > 1;

  return (
    <section className="py-12 bg-gray-50" aria-labelledby="testimonials-heading">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Customer Reviews
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Real feedback from families in Spring Hill, TN and nearby areas — including verified Google reviews.
          </p>

          {ratingStats && ratingStats.totalReviews > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-5">
              <StarRating rating={ratingStats.averageRating} size={22} allowPartialStars={true} />
              <span className="text-lg font-semibold text-gray-900">
                {ratingStats.averageRating.toFixed(1)}
              </span>
              <span className="text-gray-600">
                ({ratingStats.totalReviews} {ratingStats.totalReviews === 1 ? 'review' : 'reviews'})
              </span>

              {firstGoogleUrl && (
                <a
                  href={firstGoogleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:text-blue-800 underline font-medium text-sm"
                  aria-label="Read more reviews on Google"
                >
                  Read more on Google
                </a>
              )}
            </div>
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Navigation Buttons (kept inside on mobile so they’re tappable) */}
          {showNav && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 md:left-0 top-1/2 -translate-y-1/2 z-10 p-2.5 md:p-3 bg-white rounded-full shadow-md hover:shadow-lg transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Previous review"
                type="button"
              >
                <ChevronLeft size={22} className="text-gray-700" />
              </button>

              <button
                onClick={goToNext}
                className="absolute right-2 md:right-0 top-1/2 -translate-y-1/2 z-10 p-2.5 md:p-3 bg-white rounded-full shadow-md hover:shadow-lg transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Next review"
                type="button"
              >
                <ChevronRight size={22} className="text-gray-700" />
              </button>
            </>
          )}

          {/* Review Cards */}
          <div className="overflow-hidden rounded-lg">
            <div
              className="flex"
              style={{
                transform: `translateX(-${currentIndex * 100}%)`,
                transition: prefersReducedMotion ? 'none' : 'transform 500ms ease-in-out',
              }}
              aria-live={isAutoScrolling ? 'off' : 'polite'}
            >
              {REVIEWS.map((review) => (
                <div key={review.id} className="w-full flex-shrink-0 px-2 sm:px-4">
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          {showNav && (
            <div className="flex justify-center mt-5 space-x-2">
              {REVIEWS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                    index === currentIndex ? 'w-6 bg-blue-600' : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to review ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                  type="button"
                />
              ))}
            </div>
          )}

          {/* Auto-scroll indicator (hide if reduced motion) */}
          {!prefersReducedMotion && showNav && (
            <div className="flex justify-center mt-3">
              <div className="flex items-center text-xs text-gray-500">
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    isAutoScrolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                {isAutoScrolling ? 'Auto-scrolling' : 'Paused'}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-9 md:mt-10">
          <p className="text-gray-700 mb-4 text-sm md:text-base">
            Ready to join our satisfied customers?
          </p>
          <button
            onClick={() => {
              const formSection = document.getElementById('contact-form-section');
              if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="inline-flex items-center px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            type="button"
          >
            Get Your Free Quote
          </button>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
