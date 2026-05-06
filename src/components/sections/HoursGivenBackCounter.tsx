import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Clock3 } from 'lucide-react';

type HoursGivenBackCounterProps = {
  totalHoursSaved: number;
};

type FlipDigitProps = {
  target: number;
  shouldAnimate: boolean;
  delay: number;
};

const STEP_MS = 160;

const FlipDigit: React.FC<FlipDigitProps> = ({ target, shouldAnimate, delay }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || animatingRef.current) return;
    animatingRef.current = true;

    const el = spanRef.current;
    if (!el) return;

    const totalSteps = target === 0 ? 10 : target;
    let step = 0;
    let digit = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      // Slide current digit out (up)
      el.classList.add('rolling-out');

      setTimeout(() => {
        if (cancelled) return;

        // Update the digit text while hidden
        digit = (digit + 1) % 10;
        el.textContent = String(digit);

        // Position below (no transition) then slide in
        el.classList.remove('rolling-out');
        el.classList.add('rolling-in');

        // Force browser to commit the rolling-in position before transitioning
        el.getBoundingClientRect();

        // Now remove rolling-in to transition to center
        el.classList.remove('rolling-in');
      }, 100);

      step++;
      if (step < totalSteps) {
        setTimeout(tick, STEP_MS);
      }
    };

    const startTimeout = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [shouldAnimate, target, delay]);

  return (
    <div className="flip-tile">
      <div className="flip-tile-inner">
        <span ref={spanRef}>0</span>
      </div>
      <div className="flip-tile-seam" />
    </div>
  );
};

const HoursGivenBackCounter: React.FC<HoursGivenBackCounterProps> = ({ totalHoursSaved }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const hasTriggeredRef = useRef(false);

  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        setShouldAnimate(true);
      }
    });
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(observerCallback, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [observerCallback]);

  const rawHours = Number.isFinite(totalHoursSaved) ? Math.max(0, totalHoursSaved) : 0;
  if (rawHours <= 0) return null;

  const formatted = rawHours.toFixed(1);
  const fullDays = Math.floor(rawHours / 8);
  const contextLine = fullDays >= 2
    ? `That is more than ${fullDays} full days given back to our customers.`
    : 'Every hour we work is one you get to spend on what matters most.';

  const chars = formatted.split('');
  let digitIndex = 0;

  return (
    <section
      ref={sectionRef}
      className="py-14 md:py-20 bg-gradient-to-b from-gray-50 to-white"
      aria-label="Hours given back to customers"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] uppercase text-gray-500">
              Hours Given Back to Customers
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3" aria-hidden="true">
            {chars.map((char, i) => {
              if (char === '.') {
                return (
                  <span key={`dot-${i}`} className="flip-dot">
                    .
                  </span>
                );
              }

              const targetDigit = parseInt(char, 10);
              const currentDigitIndex = digitIndex;
              digitIndex++;

              return (
                <FlipDigit
                  key={`digit-${i}`}
                  target={targetDigit}
                  shouldAnimate={shouldAnimate}
                  delay={currentDigitIndex * 250}
                />
              );
            })}
            <span className="ml-2 md:ml-4 text-2xl md:text-4xl font-semibold text-gray-400 self-center">
              hrs
            </span>
          </div>

          <span className="sr-only">{formatted} hours given back to customers</span>

          <p className="mt-8 text-base md:text-lg text-gray-500">
            {contextLine}
          </p>
        </div>
      </div>
    </section>
  );
};

export default HoursGivenBackCounter;
