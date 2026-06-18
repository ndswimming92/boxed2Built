import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface FormProgressRailProps {
  /** Completion percentage (0-100). */
  progress: number;
  /** The form card element the rail tracks for visibility and horizontal alignment. */
  targetRef: React.RefObject<HTMLElement>;
}

const RAIL_WIDTH = 64; // px — width of the rail column (track + label)
const GAP = 24; // px — gap between the rail and the form card

/**
 * A slim vertical progress rail that floats in the left margin next to the
 * quote form on large screens. It is pinned in the viewport (fixed, vertically
 * centered) and only fades in while the form card is actually on screen.
 * On small screens it renders nothing — the form keeps a sticky top bar there.
 */
const FormProgressRail: React.FC<FormProgressRailProps> = ({ progress, targetRef }) => {
  const [inView, setInView] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Only show the rail while the form card is intersecting the viewport.
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '-10% 0px -10% 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef]);

  // Anchor the rail just to the left of the form card. The card's left edge only
  // moves on horizontal layout changes, so recompute on resize (not on scroll).
  useEffect(() => {
    const compute = () => {
      const el = targetRef.current;
      if (!el) return;
      setLeft(el.getBoundingClientRect().left);
    };
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', compute);
    };
  }, [targetRef, inView]);

  const isComplete = progress >= 100;
  const barColor = progress === 0 ? 'bg-gray-300' : isComplete ? 'bg-green-600' : 'bg-blue-600';
  const textColor = progress === 0 ? 'text-gray-500' : isComplete ? 'text-green-700' : 'text-blue-700';

  const motivationalText = (() => {
    if (progress === 0) return 'Get started';
    if (progress < 25) return 'Just getting started';
    if (progress < 50) return 'Making progress';
    if (progress < 75) return 'Over halfway there';
    if (progress < 100) return 'Almost there';
    return 'Ready to submit!';
  })();

  // Keep the rail inside the viewport even on narrower large screens.
  const computedLeft = left == null ? 0 : Math.max(8, left - GAP - RAIL_WIDTH);
  const visible = inView && left != null;

  return (
    <div
      ref={railRef}
      className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-30 flex-col items-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ left: computedLeft, width: RAIL_WIDTH }}
      role="progressbar"
      aria-label={`Form completion: ${progress}%`}
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={`mb-3 text-sm font-bold ${textColor}`}>{progress}%</span>

      <div className="relative w-2.5 h-56 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 w-full ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ height: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col items-center text-center">
        {isComplete && <CheckCircle size={18} className="text-green-600 mb-1" />}
        <span className={`text-[11px] font-medium leading-tight ${textColor}`}>
          {motivationalText}
        </span>
      </div>
    </div>
  );
};

export default FormProgressRail;
