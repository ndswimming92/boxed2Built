import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Star, Clock, MapPin, Phone, Clock3 } from 'lucide-react';
import Button from '../ui/Button';
import StarRating from '../ui/StarRating';
import { trackEvent, trackConversion } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { useHeroImage } from '../../hooks/useHeroImage';
import { calculateRatingStats } from '../../utils/ratingCalculations';
import { BUSINESS_INFO } from '../../constants/localSEO';

const HomeHero: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const { images: heroImages, activeIndex, goToIndex } = useHeroImage();

  const allReviews = businessData?.reviews || [];
  const headerReviews = allReviews.filter((r) => r.show_in_header);
  const displayReviews = headerReviews.length > 0 ? headerReviews : allReviews.slice(0, 1);

  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (displayReviews.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setActiveReviewIndex((prev) => (prev + 1) % displayReviews.length);
        setFadeIn(true);
      }, 600);
    }, 6000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [displayReviews.length]);

  const handleContactFormClick = () => {
    trackEvent('cta_click', 'hero', {
      event_category: 'conversion',
      event_label: 'get_free_quote_hero',
      value: 1,
      user_engagement: 'scroll_to_form',
      element_type: 'button',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'scroll_to_form',
      conversion_type: 'form_intent',
    });
    trackConversion('cta_click', 1, 'USD', {
      page_section: 'hero',
      conversion_type: 'form_intent',
    });

    const formSection = document.getElementById('contact-form-section');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePhoneClick = () => {
    trackEvent('phone_click', 'hero', {
      event_category: 'contact',
      event_label: 'phone_click_hero',
      value: 1,
      user_engagement: 'phone_click',
      element_type: 'link',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'phone_click',
      conversion_type: 'phone_lead',
    });
  };

  if (loading) {
    return (
      <section className="relative pt-20 pb-6 md:pt-24 md:pb-12 bg-gradient-to-br from-blue-50 via-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto animate-pulse">
            <h1 className="sr-only">Furniture Assembly in Spring Hill, TN</h1>
            <div className="h-12 md:h-16 bg-gray-200 rounded w-3/4 mb-3 md:mb-4"></div>
            <div className="h-6 md:h-8 bg-gray-200 rounded w-1/2 mb-4 md:mb-8"></div>
            <div className="h-10 md:h-12 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </section>
    );
  }

  const businessName = businessData?.info?.name || 'Boxed2Built';
  const locality = businessData?.address?.address_locality || 'Spring Hill';
  const region = businessData?.address?.address_region || 'TN';
  const ratingStats = calculateRatingStats(allReviews);

  return (
    <section className="relative pt-20 pb-0 md:pt-24 md:pb-0 bg-gradient-to-br from-blue-50 via-white to-gray-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden hidden md:block">
        <div className="absolute right-0 top-1/4 w-96 h-96 bg-blue-100 rounded-full opacity-30 blur-3xl transform translate-x-1/2"></div>
        <div className="absolute left-0 bottom-1/4 w-80 h-80 bg-green-100 rounded-full opacity-30 blur-3xl transform -translate-x-1/2"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">

            <div className="w-full lg:w-[55%] min-w-0 animate-fadeIn">
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-snug md:leading-tight mb-2 md:mb-4">
                Furniture Assembly in {locality}, {region}
                <span className="block text-blue-600 mt-1 md:mt-2 text-xl md:text-3xl lg:text-4xl">
                  IKEA, Walmart & Flat-Pack Furniture Built for You
                </span>
              </h1>

              {ratingStats.totalReviews > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 md:mb-6">
                  <StarRating rating={ratingStats.averageRating} size={18} />
                  <span className="text-sm md:text-base font-semibold text-gray-800">
                    {ratingStats.averageRating.toFixed(1)} from {ratingStats.totalReviews} Google Reviews
                  </span>
                </div>
              )}

              {displayReviews.length > 0 && (
                <blockquote
                  className="text-sm md:text-base text-gray-600 italic border-l-2 border-blue-300 pl-3 mb-5 md:mb-8 transition-opacity duration-500 ease-in-out"
                  style={{ opacity: fadeIn ? 1 : 0 }}
                >
                  "{displayReviews[activeReviewIndex]?.review_body}"
                  <span className="not-italic font-medium text-gray-800"> — {displayReviews[activeReviewIndex]?.author_name}</span>
                </blockquote>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 md:mb-5">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleContactFormClick}
                  className="group w-full sm:w-auto min-h-[52px] whitespace-nowrap text-sm md:text-base lg:text-lg px-5 py-3 md:px-8 md:py-4 shadow-xl hover:shadow-2xl"
                  trackingLabel="get_free_quote_hero"
                  pageSection="hero"
                  aria-label="Get a free furniture assembly quote in Spring Hill TN"
                >
                  Get a Free Quote
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform w-5 h-5 md:w-6 md:h-6" />
                </Button>

                <a
                  href="tel:+16154034538"
                  onClick={handlePhoneClick}
                  className="inline-flex w-full sm:w-auto min-h-[52px] items-center justify-center whitespace-nowrap text-sm md:text-base px-5 py-3 md:px-6 md:py-4 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  aria-label="Call Boxed2Built at (615) 403-4538"
                >
                  <Phone className="mr-2 w-5 h-5 flex-shrink-0" />
                  {BUSINESS_INFO.phoneFormatted}
                </a>
              </div>

              {(() => {
                const rawHours = Number(businessData?.info?.total_client_hours_saved) || 0;
                if (rawHours <= 0) return null;
                const formattedHours = rawHours.toFixed(1);
                const fullDays = Math.floor(rawHours / 8);
                const contextLine = fullDays >= 2
                  ? `That is more than ${fullDays} full days given back to our customers.`
                  : `Every hour we work is one you get to spend on what matters most.`;
                return (
                  <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Clock3 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 leading-none mb-0.5">
                          Hours Given Back to Customers
                        </p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-bold text-gray-900 leading-none">{formattedHours}</span>
                          <span className="text-sm font-medium text-gray-500">hrs</span>
                          {fullDays >= 2 && (
                            <span className="text-xs text-gray-500">&mdash; {contextLine}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <span className="sr-only">
                {businessName} — Serving {locality}, {region}
              </span>
            </div>

            {heroImages.length > 0 && (
              <div className="w-full lg:w-[45%] min-w-0 animate-fadeIn" style={{ animationDelay: '150ms' }}>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent z-10 pointer-events-none" />
                  <div className="relative h-64 sm:h-80 md:h-96 lg:h-[480px]">
                    {heroImages.map((img, idx) => (
                      <img
                        key={img.src}
                        src={img.src}
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        decoding={idx === 0 ? 'sync' : 'async'}
                        fetchPriority={idx === 0 ? 'high' : 'low'}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                          idx === activeIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{ objectPosition: `${img.focusX}% ${img.focusY}%` }}
                      />
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-end justify-between">
                    <p className="text-white text-sm font-medium drop-shadow-lg">
                      {heroImages[activeIndex]?.title}
                    </p>
                    {heroImages.length > 1 && (
                      <div className="flex gap-2">
                        {heroImages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => goToIndex(idx)}
                            aria-label={`Show image ${idx + 1}`}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                              idx === activeIndex
                                ? 'bg-white scale-110'
                                : 'bg-white/50 hover:bg-white/75'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-8 md:mt-12 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-3 divide-x divide-gray-200">
              <div className="flex items-center justify-center gap-2 md:gap-3 py-4 md:py-5">
                <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                  <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                </div>
                <span className="text-xs md:text-sm font-semibold text-gray-800">5-Star Rated</span>
              </div>
              <div className="flex items-center justify-center gap-2 md:gap-3 py-4 md:py-5">
                <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                </div>
                <span className="text-xs md:text-sm font-semibold text-gray-800">Same-Day Available</span>
              </div>
              <div className="flex items-center justify-center gap-2 md:gap-3 py-4 md:py-5">
                <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                </div>
                <span className="text-xs md:text-sm font-semibold text-gray-800">Locally Owned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
