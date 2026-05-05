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

const FLIP_INTERVAL_MS = 90;
const FLIP_TRANSITION_MS = 70;

const FlipDigit: React.FC<FlipDigitProps> = ({ target, shouldAnimate, delay }) => {
  const [current, setCurrent] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [prev, setPrev] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || startedRef.current) return;
    startedRef.current = true;

    timeoutRef.current = setTimeout(() => {
      let digit = 0;

      const tick = () => {
        if (digit === target) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        setPrev(digit);
        digit = (digit + 1) % 10;
        setFlipping(true);

        setTimeout(() => {
          setCurrent(digit);
          setFlipping(false);
        }, FLIP_TRANSITION_MS);

        if (digit === target) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      };

      intervalRef.current = setInterval(tick, FLIP_INTERVAL_MS);
      tick();
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shouldAnimate, target, delay]);

  useEffect(() => {
    if (!shouldAnimate) {
      setCurrent(target);
    }
  }, [shouldAnimate, target]);

  return (
    <div className="flip-digit-tile">
      <div className="flip-digit-top">
        <span className="flip-digit-num">{flipping ? prev : current}</span>
      </div>
      <div className="flip-digit-bottom">
        <span className="flip-digit-num">{current}</span>
      </div>
      <div className="flip-digit-seam" />
      {flipping && (
        <div className="flip-digit-flap-container">
          <div className="flip-digit-flap flip-digit-flap-animate">
            <span className="flip-digit-num">{current}</span>
          </div>
        </div>
      )}
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
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] uppercase text-gray-500">
              Hours Given Back to Customers
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 md:gap-2.5" aria-hidden="true">
            {chars.map((char, i) => {
              if (char === '.') {
                return (
                  <span key={`dot-${i}`} className="flip-digit-dot">
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
                  delay={currentDigitIndex * 200}
                />
              );
            })}
            <span className="ml-2 md:ml-3 text-2xl md:text-3xl font-semibold text-gray-400 self-end pb-2 md:pb-3">
              hrs
            </span>
          </div>

          <span className="sr-only">{formatted} hours given back to customers</span>

          <p className="mt-6 text-base md:text-lg text-gray-500">
            {contextLine}
          </p>
        </div>
      </div>
    </section>
  );
};

export default HoursGivenBackCounter;
