import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { REVIEWS } from '../../constants/reviews';
import { trackEvent } from '../../utils/analytics';
import Button from '../ui/Button';
import { getCalendlyUrl } from '../../utils/utm';

const Testimonials: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % REVIEWS.length);
    setTimeout(() => setIsAnimating(false), 300);
    trackEvent('testimonial-carousel-next');
  };

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length);
    setTimeout(() => setIsAnimating(false), 300);
    trackEvent('testimonial-carousel-previous');
  };

  const handleDotClick = (index: number) => {
    if (isAnimating || index === currentIndex) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 300);
    trackEvent('testimonial-carousel-dot-click');
  };

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-testimonials');
    window.open(getCalendlyUrl('services'), '_blank');
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-testimonials');
  };

  const currentReview = REVIEWS[currentIndex];

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Our Spring Hill Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Real reviews from satisfied customers who chose Boxed2Built for their furniture assembly needs
            </p>
          </div>

          {/* Carousel Container */}
          <div className="relative mb-8">
            {/* Navigation Buttons */}
            <button
              onClick={handlePrevious}
              disabled={isAnimating}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 z-10 p-3 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous review"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              onClick={handleNext}
              disabled={isAnimating}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 z-10 p-3 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next review"
            >
              <ChevronRight size={24} />
            </button>

            {/* Review Card */}
            <div className="bg-white rounded-xl shadow-xl p-8 mx-8 relative overflow-hidden">
              <div
                className={`transition-all duration-300 ${
                  isAnimating ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'
                }`}
              >
                {/* Quote Icon */}
                <div className="absolute top-6 left-6 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Quote className="text-blue-600" size={24} />
                </div>

                {/* Star Rating */}
                <div className="flex justify-center mb-6 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={24}
                      className={`${
                        i < currentReview.rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Review Text */}
                <blockquote className="text-xl text-gray-700 leading-relaxed mb-6 italic">
                  "{currentReview.text}"
                </blockquote>

                {/* Author Info */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {currentReview.author}
                    </h3>
                    {currentReview.googleReviewUrl ? (
                      <a
                        href={currentReview.googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer ugc"
                        onClick={() => trackEvent('google-review-testimonial-click')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium underline transition-colors"
                      >
                        Verified {currentReview.source} Review
                      </a>
                    ) : (
                      <span className="text-gray-500 text-sm">{currentReview.source} Review</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dot Indicators */}
          <div className="flex justify-center space-x-3 mb-8">
            {REVIEWS.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-blue-600 scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to review ${index + 1}`}
              />
            ))}
          </div>

          {/* Review Counter */}
          <p className="text-sm text-gray-500 mb-8">
            Review {currentIndex + 1} of {REVIEWS.length}
          </p>

          {/* Call to Action */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Join Our Satisfied Customers?
            </h3>
            <p className="text-gray-600 mb-6">
              Experience the same professional furniture assembly service that earned these great reviews.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleBookingClick}
                variant="primary"
                size="lg"
                trackingLabel="book-consultation-testimonials"
              >
                Book Free Consultation
              </Button>
              
              <a
                href="tel:+19316741196"
                onClick={handlePhoneClick}
                className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
              >
                Call (931) 674-1196
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;