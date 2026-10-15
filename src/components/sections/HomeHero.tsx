import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Star, ShieldCheck, MapPin, Phone } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { trackEvent, trackConversion } from '../../utils/analytics';
import { useBusinessDataWithFallback } from '../../hooks/useBusinessData';
import { useHeroImage } from '../../hooks/useHeroImage';
import { useBookingEnabled } from '../../hooks/useBookingPublicInfo';
import { calculateRatingStats, getWrittenReviews } from '../../utils/ratingCalculations';
import { formatPhoneForDisplay } from '../../services/communicationService';




const HomeHero: React.FC = () => {
  const { data: businessData, loading } = useBusinessDataWithFallback();
  const { images: heroImages, activeIndex, goToIndex } = useHeroImage();

  const allReviews = businessData?.reviews || [];
  // The hero quotes a review body, so a star-only rating can't fill this slot.
  // It still counts in the rating summary, which mirrors the Google total.
  const quotableReviews = getWrittenReviews(allReviews);
  const headerReviews = quotableReviews.filter((r) => r.show_in_header);
  const displayReviews = headerReviews.length > 0 ? headerReviews : quotableReviews.slice(0, 1);

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

  const bookingEnabled = useBookingEnabled();

  const handleBookingClick = () => {
    trackEvent('cta_click', 'hero', {
      event_category: 'conversion',
      event_label: 'book_time_hero',
      value: 1,
      element_type: 'link',
      element_location: 'hero',
      page_section: 'hero',
      action_type: 'click',
      action_value: '/book',
      conversion_type: 'booking_intent',
    });
  };

  if (loading) {
    return (
      <section className="relative pt-20 pb-6 md:pt-24 md:pb-12 bg-[#0E2748]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto animate-pulse">
            <h1 className="sr-only">Furniture Assembly in Spring Hill, TN</h1>
            <div className="h-12 md:h-16 bg-white/10 rounded w-3/4 mb-3 md:mb-4"></div>
            <div className="h-6 md:h-8 bg-white/10 rounded w-1/2 mb-4 md:mb-8"></div>
            <div className="h-10 md:h-12 bg-white/10 rounded w-48"></div>
          </div>
        </div>
      </section>
    );
  }

  const businessName = businessData?.info?.name || 'Boxed2Built';
  const locality = businessData?.address?.address_locality || 'Spring Hill';
  const region = businessData?.address?.address_region || 'TN';
  const ratingStats = calculateRatingStats(allReviews);
  const phoneRaw = businessData?.info?.phone || '+16154034538';
  const phoneDisplay = formatPhoneForDisplay(phoneRaw.replace(/^\+1/, ''));

  const handleQuoteButtonClick = () => {
    trackEvent('button_click', 'hero', {
      event_category: 'button_click',
      event_label: 'get_free_quote_hero',
      element_type: 'button',
      element_text: 'Get My Free Quote',
      element_location: 'hero',
      action_type: 'click',
      action_value: 'get_free_quote_hero',
    });
    handleContactFormClick();
  };

  return (
    <section className="relative pt-20 pb-0 md:pt-24 md:pb-0 bg-[#0E2748] text-white overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto pt-6 pb-12 md:pt-10 md:pb-16 lg:pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

            <div className="w-full lg:w-[55%] min-w-0 animate-fadeIn">
              <h1 className="text-[2.25rem] leading-[1.08] md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-white mb-4 md:mb-5">
                Furniture Assembly in {locality}, {region}
                <span className="block mt-3 md:mt-4 text-xl md:text-2xl lg:text-[1.65rem] leading-snug font-medium tracking-normal text-[#D7DFEC]">
                  IKEA, Walmart &amp; Flat-Pack Furniture{' '}
                  <span className="font-bold text-white border-b-[3px] border-[#D9A441] pb-0.5 whitespace-nowrap">
                    Built for You
                  </span>
                </span>
              </h1>

              {ratingStats.totalReviews > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 md:mb-5">
                  <StarRating rating={ratingStats.averageRating} size={20} />
                  <span className="text-sm md:text-base font-semibold text-white">
                    {ratingStats.averageRating.toFixed(1)} from {ratingStats.totalReviews} Google Reviews
                  </span>
                </div>
              )}

              {displayReviews.length > 0 && (
                <blockquote
                  className="max-w-xl text-base md:text-[17px] leading-relaxed text-[#C9D2E6] italic mb-7 md:mb-8 transition-opacity duration-500 ease-in-out"
                  style={{ opacity: fadeIn ? 1 : 0 }}
                >
                  <span aria-hidden="true" className="not-italic font-extrabold text-[#D9A441] text-3xl leading-none align-[-0.35em] mr-1">&ldquo;</span>
                  {displayReviews[activeReviewIndex]?.review_body}&rdquo;
                  <span className="block mt-2 not-italic font-bold text-sm md:text-[15px] text-white">— {displayReviews[activeReviewIndex]?.author_name}</span>
                </blockquote>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-3.5 mb-4 md:mb-5">
                <button
                  type="button"
                  onClick={handleQuoteButtonClick}
                  className="group inline-flex w-full sm:w-auto min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#D9A441] hover:bg-[#E9BE6A] text-[#0E2748] px-7 md:px-8 py-4 text-base md:text-lg font-extrabold shadow-[0_10px_24px_rgba(217,164,65,0.28)] hover:shadow-[0_14px_30px_rgba(217,164,65,0.4)] hover:-translate-y-px transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
                  aria-label="Get a free furniture assembly quote in Spring Hill TN"
                >
                  Get My Free Quote
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href={`tel:${phoneRaw}`}
                  className="inline-flex w-full sm:w-auto min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#13807A] hover:bg-[#0F6B66] text-white px-6 py-4 text-base md:text-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
                  aria-label={`Call Boxed2Built at ${phoneDisplay}`}
                >
                  <Phone className="w-5 h-5 flex-shrink-0" />
                  {phoneDisplay}
                </a>
              </div>


              {/* Deliberately a link, not a third button. The quote form asks for
                  nothing and suits someone still deciding; booking asks for a
                  Google sign-in and suits someone who already knows the job.
                  Making both look equally primary would just split the ask. */}
              {bookingEnabled && (
                <p className="mb-2 text-sm md:text-base text-[#C9D2E6]">
                  Already know what you need?{' '}
                  <a
                    href="/book"
                    onClick={handleBookingClick}
                    className="font-semibold text-[#E9BE6A] underline decoration-[#D9A441]/60 underline-offset-2 hover:text-white hover:decoration-white"
                  >
                    Pick a time that works for you
                  </a>
                  .
                </p>
              )}

              <span className="sr-only">
                {businessName} — Serving {locality}, {region}
              </span>
            </div>

            {heroImages.length > 0 && (
              <div className="w-full lg:w-[45%] min-w-0 animate-fadeIn" style={{ animationDelay: '150ms' }}>
                <div className="relative pt-3 pr-3 md:pt-[18px] md:pr-[18px]">
                  <div aria-hidden="true" className="absolute top-0 right-0 bottom-3 left-3 md:bottom-[18px] md:left-[18px] rounded-[26px] border-2 border-[#D9A441] pointer-events-none" />
                  <div className="relative rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.35)] group">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E2748]/50 via-transparent to-transparent z-10 pointer-events-none" />
                    <div className="relative h-72 sm:h-80 md:h-96 lg:h-[480px]">
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
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-end justify-between gap-3">
                      {heroImages[activeIndex]?.title && (
                        <p className="px-3 py-2 rounded-lg bg-[#0E2748]/85 text-white text-sm font-semibold">
                          {heroImages[activeIndex]?.title}
                        </p>
                      )}
                      {heroImages.length > 1 && (
                        <div className="flex gap-2 ml-auto">
                          {heroImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => goToIndex(idx)}
                              aria-label={`Show image ${idx + 1}`}
                              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                idx === activeIndex
                                  ? 'bg-[#D9A441] scale-110'
                                  : 'bg-white/60 hover:bg-white/85'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-[#091C38] border-t border-[#D9A441]/45">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-3 divide-x divide-white/10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 md:py-6 text-center">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-[#D9A441] flex-shrink-0" aria-hidden="true" />
                <span className="text-xs md:text-base font-bold text-white">5-Star Rated</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 md:py-6 text-center">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-[#D9A441] flex-shrink-0" aria-hidden="true" />
                <span className="text-xs md:text-base font-bold text-white">No Payment Until Done</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 md:py-6 text-center">
                <MapPin className="w-5 h-5 md:w-6 md:h-6 text-[#D9A441] flex-shrink-0" aria-hidden="true" />
                <span className="text-xs md:text-base font-bold text-white">Locally Owned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
