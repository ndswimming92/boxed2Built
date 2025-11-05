import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReviewCard from '../ReviewCard';
import StarRating from '../ui/StarRating';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { calculateRatingStats } from '../../utils/ratingCalculations';

const Testimonials: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const REVIEWS = businessData?.reviews.map(review => ({
    id: review.id,
    author: review.author_name,
    text: review.review_body,
    rating: review.rating_value,
    datePublished: review.date_published,
    source: review.is_verified ? 'Google' : 'Customer',
    googleReviewUrl: review.is_verified ? 'https://www.google.com/maps/place/Boxed2Built/@35.7513,-86.9236,17z/data=!4m8!3m7!1s0x886466e6e6e6e6e6:0x1234567890abcdef!8m2!3d35.7513!4d-86.9236!9m1!1b1!16s%2Fg%2F11y3qr8h5z' : undefined
  })) || [];

  const ratingStats = useMemo(() => {
    if (!businessData?.reviews) return null;
    return calculateRatingStats(businessData.reviews);
  }, [businessData?.reviews]);

  // Auto-scroll functionality
  useEffect(() => {
    if (!isAutoScrolling || REVIEWS.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === REVIEWS.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoScrolling, REVIEWS.length]);

  // Pause auto-scroll when user interacts
  const handleManualNavigation = (newIndex: number) => {
    setCurrentIndex(newIndex);
    setIsAutoScrolling(false);
    
    // Resume auto-scroll after 10 seconds of inactivity
    setTimeout(() => {
      setIsAutoScrolling(true);
    }, 10000);
  };

  const goToPrevious = () => {
    const newIndex = currentIndex === 0 ? REVIEWS.length - 1 : currentIndex - 1;
    handleManualNavigation(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex === REVIEWS.length - 1 ? 0 : currentIndex + 1;
    handleManualNavigation(newIndex);
  };

  const goToSlide = (index: number) => {
    handleManualNavigation(index);
  };

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

  if (REVIEWS.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Real reviews from satisfied customers in Spring Hill, TN and surrounding areas.
          </p>

          {ratingStats && ratingStats.totalReviews > 0 && (
            <div className="flex items-center justify-center mt-6">
              <StarRating
                rating={ratingStats.averageRating}
                size={24}
                allowPartialStars={true}
              />
              <span className="ml-3 text-xl font-semibold text-gray-900">
                {ratingStats.averageRating.toFixed(1)}
              </span>
              <span className="ml-2 text-gray-600">
                ({ratingStats.totalReviews} {ratingStats.totalReviews === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Navigation Buttons */}
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-50"
            aria-label="Previous review"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-50"
            aria-label="Next review"
          >
            <ChevronRight size={24} className="text-gray-600" />
          </button>

          {/* Review Cards */}
          <div className="overflow-hidden rounded-lg">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {REVIEWS.map((review, index) => (
                <div key={review.id} className="w-full flex-shrink-0 px-4">
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-6 space-x-2">
            {REVIEWS.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-blue-600 scale-110'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to review ${index + 1}`}
              />
            ))}
          </div>

          {/* Auto-scroll indicator */}
          <div className="flex justify-center mt-4">
            <div className="flex items-center text-sm text-gray-500">
              <div className={`w-2 h-2 rounded-full mr-2 ${isAutoScrolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isAutoScrolling ? 'Auto-scrolling' : 'Paused'}
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <p className="text-gray-600 mb-4">
            Ready to join our satisfied customers?
          </p>
          <button
            onClick={() => {
              const formSection = document.getElementById('contact-form-section');
              if (formSection) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="inline-flex items-center px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            Get Your Free Quote
          </button>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;