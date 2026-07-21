import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import ReviewCard from '../ReviewCard';
import StarRating from '../ui/StarRating';
import { Review } from '../../types';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { calculateRatingStats } from '../../utils/ratingCalculations';

const AUTOSCROLL_MS = 5000;
const RESUME_AFTER_MS = 10000;

// Google Business results for Boxed2Built — where "Read more on Google" points.
// Canonical search URL (no browser-session tracking params) so it stays stable.
const GOOGLE_REVIEWS_URL = 'https://www.google.com/search?q=boxed2built';

// Avatars cycle through the brand's soft tints so adjacent cards read distinctly.
const TINTS: NonNullable<Review['tint']>[] = ['blue', 'green', 'emerald'];

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

const Testimonials: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  // Bumped on every slide change so the progress bar remounts and restarts.
  const [cycleId, setCycleId] = useState(0);

  // Avoid stacking timeouts when user clicks multiple times
  const resumeTimeoutRef = useRef<number | null>(null);

  // Respect "reduced motion" — must be false on initial render to match the SSG
  // snapshot, then updated after mount via useEffect to avoid hydration mismatch.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    setPrefersReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  const REVIEWS: Review[] = useMemo(() => {
    if (!businessData?.reviews) return [];
    return businessData.reviews.map((review, index) => ({
      id: review.id,
      author: review.author_name,
      text: review.review_body,
      rating: review.rating_value,
      datePublished: review.date_published,
      source: review.is_verified ? 'Google' : 'Customer',
      initials: getInitials(review.author_name),
      tint: TINTS[index % TINTS.length],
      googleReviewUrl: review.is_verified
        ? 'https://www.google.com/maps/place/Boxed2Built/@35.7513,-86.9236,17z/data=!4m8!3m7!1s0x886466e6e6e6e6e6:0x1234567890abcdef!8m2!3d35.7513!4d-86.9236!9m1!1b1!16s%2Fg%2F11y3qr8h5z'
        : undefined,
    }));
  }, [businessData?.reviews]);

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
      setCycleId((prev) => prev + 1);
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
    setCycleId((prev) => prev + 1);

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

  // Peek layout — position every card relative to the centered one and let the
  // neighbours peek at reduced scale/opacity. Wraps around at both ends.
  const cards = useMemo(() => {
    const len = REVIEWS.length;
    return REVIEWS.map((review, idx) => {
      let offset = idx - currentIndex;
      if (offset > len / 2) offset -= len;
      if (offset < -len / 2) offset += len;

      const isCenter = offset === 0;
      const visible = Math.abs(offset) <= 1;
      const tx = offset * 56;
      const scale = isCenter ? 1 : 0.86;

      const wrapStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: '50%',
        width: '62%',
        height: '100%',
        transform: `translate(calc(-50% + ${tx}%), 0) scale(${scale})`,
        opacity: isCenter ? 1 : visible ? 0.4 : 0,
        zIndex: isCenter ? 10 : 5,
        pointerEvents: isCenter ? 'auto' : 'none',
        transition: prefersReducedMotion
          ? 'none'
          : 'transform 500ms cubic-bezier(0.16,1,0.3,1), opacity 500ms ease',
      };

      return { review, isCenter, wrapStyle };
    });
  }, [REVIEWS, currentIndex, prefersReducedMotion]);

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
    <section className="py-16 bg-gray-50" aria-labelledby="testimonials-heading">
      <div className="container mx-auto px-6">
        <div className="text-center mb-10">
          <h2
            id="testimonials-heading"
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-3.5"
          >
            Customer Reviews
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
            Real feedback from families in Spring Hill, TN and nearby areas — including verified Google reviews.
          </p>

          {ratingStats && ratingStats.totalReviews > 0 && (
            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 mt-5 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm">
              <StarRating rating={ratingStats.averageRating} size={20} allowPartialStars={true} />
              <span className="text-lg font-bold text-gray-900">
                {ratingStats.averageRating.toFixed(1)}
              </span>
              <span className="text-gray-600 text-sm">
                ({ratingStats.totalReviews} {ratingStats.totalReviews === 1 ? 'review' : 'reviews'})
              </span>

              {firstGoogleUrl && (
                <>
                  <span className="w-px h-4 bg-gray-200" aria-hidden="true" />
                  <a
                    href={GOOGLE_REVIEWS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800 underline font-medium text-sm"
                    aria-label="Read more reviews on Google"
                  >
                    Read more on Google
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative max-w-[980px] mx-auto">
          {/* Navigation Buttons */}
          {showNav && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute -left-2 top-[42%] -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md transition hover:shadow-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Previous review"
                type="button"
              >
                <ChevronLeft size={22} />
              </button>

              <button
                onClick={goToNext}
                className="absolute -right-2 top-[42%] -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md transition hover:shadow-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Next review"
                type="button"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Peek cards */}
          <div
            className="relative h-[388px] overflow-hidden"
            aria-live={isAutoScrolling ? 'off' : 'polite'}
          >
            {cards.map(({ review, isCenter, wrapStyle }) => (
              <div
                key={review.id}
                className={isCenter ? 'rc-center-card' : 'rc-side-card'}
                style={wrapStyle}
                aria-hidden={!isCenter}
              >
                <ReviewCard review={review} elevated={isCenter} />
              </div>
            ))}
          </div>

          {/* Dots */}
          {showNav && (
            <div className="flex justify-center gap-2 mt-5">
              {REVIEWS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className="flex items-center p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-full"
                  aria-label={`Go to review ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                  type="button"
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-200 ${
                      index === currentIndex ? 'w-[22px] bg-blue-600' : 'w-2 bg-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Auto-scroll progress bar (hidden for reduced motion) */}
          {!prefersReducedMotion && showNav && (
            <>
              <div className="max-w-[220px] mx-auto mt-3.5 h-[3px] rounded-full bg-gray-200 overflow-hidden">
                {isAutoScrolling && (
                  <div
                    key={`${currentIndex}-${cycleId}`}
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: '0%',
                      animation: `rc-fill ${AUTOSCROLL_MS}ms linear forwards`,
                    }}
                  />
                )}
              </div>

              <div className="flex justify-center mt-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className={`w-[7px] h-[7px] rounded-full ${
                      isAutoScrolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  {isAutoScrolling ? 'Auto-scrolling' : 'Paused'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-11">
          <p className="text-gray-700 mb-4 text-sm md:text-base">
            Ready to join our satisfied customers?
          </p>
          <button
            onClick={() => {
              const formSection = document.getElementById('contact-form-section');
              if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                navigate('/contact');
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            type="button"
          >
            Get Your Free Quote
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
