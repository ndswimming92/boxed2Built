import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import { trackEvent, trackConversion } from '../../utils/analytics';

type HoursGivenBackCounterProps = {
  totalHoursSaved: number;
};

type OdometerDigitProps = {
  target: number;
  shouldAnimate: boolean;
  delay: number;
  prefersReducedMotion: boolean;
};

const INITIAL_DELAY = 500;
const STAGGER_MS = 170;
// Each column holds three 0-9 loops; landing in the last loop keeps the
// roll spinning past 20 digits before settling on the target.
const DIGIT_LOOPS = 3;
const COLUMN_DIGITS = Array.from({ length: DIGIT_LOOPS * 10 }, (_, i) => i % 10);

const OdometerDigit: React.FC<OdometerDigitProps> = ({
  target,
  shouldAnimate,
  delay,
  prefersReducedMotion,
}) => {
  const settled = shouldAnimate || prefersReducedMotion;
  const restingCell = (DIGIT_LOOPS - 1) * 10 + target;
  const offsetPercent = (restingCell / COLUMN_DIGITS.length) * 100;

  return (
    <div className="odo-tile">
      <div
        className={`odo-column${settled && !prefersReducedMotion ? ' odo-animate' : ''}`}
        style={{
          transform: settled ? `translateY(-${offsetPercent}%)` : 'translateY(0)',
          transitionDelay: prefersReducedMotion ? undefined : `${delay}ms`,
        }}
      >
        {COLUMN_DIGITS.map((digit, i) => (
          <div key={i} className="odo-cell">
            {digit}
          </div>
        ))}
      </div>
      <div className="odo-seam" />
    </div>
  );
};

const HoursGivenBackCounter: React.FC<HoursGivenBackCounterProps> = ({ totalHoursSaved }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasTriggeredRef = useRef(false);

  const rawHours = Number.isFinite(totalHoursSaved) ? Math.max(0, totalHoursSaved) : 0;
  const isVisible = rawHours > 0;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || hasTriggeredRef.current) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            setShouldAnimate(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [isVisible]);

  if (!isVisible) return null;

  const formatted = rawHours.toFixed(1);
  const fullDays = Math.ceil(rawHours / 8);

  const chars = formatted.split('');
  let digitIndex = 0;

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 bg-[#0E2748] text-white"
      aria-label="Hours given back to customers"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-5">
            More Time Back in Your Week
          </h2>
          <p className="text-base md:text-lg text-[#C3CCE0] leading-relaxed mb-3">
            Furniture assembly can turn into hours of sorting parts, reading instructions, tightening bolts, adjusting doors, and cleaning up packaging.
          </p>
          <p className="text-base md:text-lg text-white font-semibold mb-10 md:mb-12">
            Boxed2Built takes that stress off your plate.
          </p>

          <div className="inline-flex items-center gap-3 mb-6 md:mb-8">
            <div className="w-10 h-10 rounded-full bg-brand-gold-cta/15 flex items-center justify-center shrink-0">
              <Clock3 className="w-5 h-5 text-brand-gold-cta" />
            </div>
            <p className="text-xs md:text-sm font-bold tracking-[0.24em] uppercase text-[#C3CCE0]">
              Total Hours Given Back to Customers
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3.5 flex-wrap" aria-hidden="true">
            {chars.map((char, i) => {
              if (char === '.') {
                return (
                  <div key={`dot-${i}`} className="odo-dot-col">
                    <div className="odo-dot" />
                  </div>
                );
              }

              const targetDigit = parseInt(char, 10);
              const currentDigitIndex = digitIndex;
              digitIndex++;

              return (
                <OdometerDigit
                  key={`digit-${i}`}
                  target={targetDigit}
                  shouldAnimate={shouldAnimate}
                  delay={INITIAL_DELAY + currentDigitIndex * STAGGER_MS}
                  prefersReducedMotion={prefersReducedMotion}
                />
              );
            })}
            <span className="ml-2 md:ml-2.5 text-2xl md:text-[40px] font-bold text-brand-gold-cta self-center">
              hrs
            </span>
          </div>

          <span className="sr-only">{formatted} hours given back to customers</span>

          <p className="mt-10 text-base md:text-lg text-[#C3CCE0] leading-relaxed">
            {fullDays >= 2 ? (
              <>
                Across every build we've completed, that's <span className="font-bold text-white">nearly {fullDays} full workdays</span> handed back to local families — and counting.
              </>
            ) : (
              'Every hour we work is one you get to spend on what matters most.'
            )}
          </p>

          <p className="mt-6 text-lg md:text-xl text-white font-semibold italic">
            Turning boxes into comfort so families can focus on what matters most.
          </p>

          <a
            href="https://boxed2built.com/contact?utm_id=B2B&utm_source=website&utm_medium=cta_button&utm_campaign=hours_given_back&utm_term=furniture+assembly&utm_content=get_your_time_back"
            onClick={() => {
              trackEvent('cta_click', 'hours_given_back', {
                event_category: 'conversion',
                event_label: 'get_your_time_back',
                element_type: 'button',
                element_location: 'hours_given_back',
                page_section: 'hours_given_back',
                action_type: 'navigate_to_contact',
                conversion_type: 'form_intent',
              });
              trackConversion('cta_click', 1, 'USD', {
                page_section: 'hours_given_back',
                conversion_type: 'form_intent',
              });
            }}
            className="group inline-flex items-center justify-center w-full sm:w-auto mt-8 px-6 py-3 md:px-8 md:py-4 bg-brand-gold-cta hover:bg-brand-gold-cta-hover text-brand-navy-deep font-semibold text-base md:text-lg rounded-lg shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/40 transition-all duration-200"
          >
            Get Your Time Back
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default HoursGivenBackCounter;
