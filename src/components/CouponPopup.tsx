import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, X } from 'lucide-react';
import {
  describePopupDeadline, popupCopy, popupOfferLabel,
  type CouponPopupContent, type CouponPopupSettings,
} from '../utils/couponPopup';

interface CouponPopupProps {
  coupon: CouponPopupContent;
  settings: Pick<CouponPopupSettings, 'fade_ms' | 'position' | 'cta_label'>;
  /** The main button: apply the code to the quote form. */
  onClaim: () => void;
  /** Called once the popup has finished fading out, however it was closed. */
  onClose: () => void;
}

/**
 * The coupon offer itself — the card, its fade and its keyboard behaviour.
 * It knows nothing about when to appear or who has seen it; the home page
 * wrapper and the admin preview both decide that and mount this.
 */
export default function CouponPopup({ coupon, settings, onClaim, onClose }: CouponPopupProps) {
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);
  const claimRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fadeMs = reducedMotion ? 0 : settings.fade_ms;
  const centered = settings.position === 'center';

  const { headline, message } = popupCopy(coupon);
  const deadline = describePopupDeadline(coupon.ends_at);

  const close = (after: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    window.setTimeout(() => {
      restoreFocusRef.current?.focus?.();
      after();
    }, fadeMs);
  };

  // Fade in on the frame after mount, so the transition has a start to run from.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      setVisible(true);
      // The centred version is a real modal, so focus moves into it. The corner
      // card sits beside the page and must not pull focus from what they are doing.
      if (centered) claimRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(onClose);
        return;
      }

      // The centred version dims the page and says it is modal, so Tab stays
      // inside it. The corner card is not a modal and leaves Tab alone.
      if (event.key !== 'Tab' || !centered || !cardRef.current) return;
      const stops = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button'));
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      if (!cardRef.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, fadeMs, centered]);

  const fade = { transitionDuration: `${fadeMs}ms` };

  return (
    <div
      data-testid="coupon-popup"
      className={
        centered
          ? 'fixed inset-0 z-[120] flex items-center justify-center p-4'
          : 'fixed inset-x-0 bottom-0 z-[120] flex justify-center p-4 pointer-events-none sm:inset-x-auto sm:right-4 sm:bottom-4 sm:p-0'
      }
    >
      {centered && (
        <div
          className={`absolute inset-0 bg-[#0E2748]/60 backdrop-blur-[2px] transition-opacity ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={fade}
          onClick={() => close(onClose)}
          aria-hidden="true"
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal={centered}
        aria-labelledby="coupon-popup-headline"
        aria-describedby="coupon-popup-message"
        className={`relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_rgba(14,39,72,0.35)] ring-1 ring-black/5 pointer-events-auto transition-[opacity,transform] ease-out ${
          visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-[0.98]'
        }`}
        style={fade}
      >
        <button
          type="button"
          onClick={() => close(onClose)}
          aria-label="Close offer"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative bg-[#0E2748] px-6 pb-7 pt-6 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: 'radial-gradient(120% 90% at 50% 0%, rgba(217,164,65,0.28), transparent 60%)' }}
            aria-hidden="true"
          />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.22em] text-[#D9A441]">
            {deadline ? 'Limited-time offer' : 'Special offer'}
          </p>
          <p className="relative mt-2 text-5xl font-extrabold leading-none tracking-tight text-white">
            {popupOfferLabel(coupon)}
          </p>
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          <h2 id="coupon-popup-headline" className="text-xl font-bold leading-snug text-[#0E2748]">
            {headline}
          </h2>
          <p id="coupon-popup-message" className="mt-2 text-sm leading-relaxed text-slate-600">
            {message}
          </p>

          <div className="mt-4 rounded-xl border-2 border-dashed border-[#D9A441] bg-[#D9A441]/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Your code</p>
            <p className="mt-0.5 break-all font-mono text-2xl font-bold tracking-[0.12em] text-[#0E2748]">
              {coupon.code}
            </p>
          </div>

          {deadline && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-[#B5842A]" aria-hidden="true" />
              {deadline}
            </p>
          )}

          <button
            ref={claimRef}
            type="button"
            onClick={() => close(onClaim)}
            className="group mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#D9A441] px-5 py-3 text-base font-extrabold text-[#0E2748] shadow-[0_10px_24px_rgba(217,164,65,0.28)] transition-all duration-200 hover:bg-[#E9BE6A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E2748] focus-visible:ring-offset-2"
          >
            {settings.cta_label}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          <p className="mt-2 text-xs text-slate-500">Free quote · the code is applied for you</p>

          <button
            type="button"
            onClick={() => close(onClose)}
            className="mt-3 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline focus:outline-none focus-visible:underline"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
