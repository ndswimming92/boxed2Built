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

const FLIP_STEP_MS = 100;

const FlipDigit: React.FC<FlipDigitProps> = ({ target, shouldAnimate, delay }) => {
  const [current, setCurrent] = useState<number | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const animatingRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || animatingRef.current) return;
    animatingRef.current = true;

    let digit = 0;
    const totalSteps = target === 0 ? 10 : target;

    const startTimeout = setTimeout(() => {
      let step = 0;

      const flip = () => {
        setPrevious(digit);
        digit = (digit + 1) % 10;
        setCurrent(digit);
        setIsFlipping(true);

        setTimeout(() => {
          setIsFlipping(false);
        }, FLIP_STEP_MS * 1.2);

        step++;
        if (step < totalSteps) {
          setTimeout(flip, FLIP_STEP_MS);
        }
      };

      flip();
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [shouldAnimate, target, delay]);

  const displayDigit = current !== null ? current : target;
  const prevDigit = previous !== null ? previous : 0;

  return (
    <div className="flip-tile">
      <div className="flip-tile-inner">
        {/* Static top half showing current digit */}
        <div className="flip-tile-top">
          <span>{displayDigit}</span>
        </div>
        {/* Static bottom half showing current digit */}
        <div className="flip-tile-bottom">
          <span>{displayDigit}</span>
        </div>
        {/* Seam line */}
        <div className="flip-tile-seam" />
        {/* Animated flap: top half folds down */}
        {isFlipping && (
          <div className="flip-tile-flap-top flip-tile-flap-down">
            <span>{prevDigit}</span>
          </div>
        )}
        {/* Animated flap: bottom half folds up to reveal */}
        {isFlipping && (
          <div className="flip-tile-flap-bottom flip-tile-flap-up">
            <span>{displayDigit}</span>
          </div>
        )}
      </div>
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
