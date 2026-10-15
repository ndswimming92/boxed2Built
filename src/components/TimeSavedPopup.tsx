import React from 'react';
import { Clock3, X } from 'lucide-react';
import {
  DIY_TIME_SAVINGS,
  estimateTimeSaved,
  formatHoursRange,
  type TimeSavingsId,
} from '../utils/diyTimeSavings';

type TimeSavedPopupProps = {
  /** The tile the customer just selected. */
  itemId: TimeSavingsId;
  label: string;
  /** Current quantities for every furniture type, to total across the whole order. */
  qty: Record<TimeSavingsId, number>;
  onClose: () => void;
};

/**
 * Pops up when a customer picks a furniture type and tells them how much of
 * their own time Boxed2Built hands back. Shows the per-piece range for the item
 * just picked, and the combined total once the order has more than one piece.
 */
const TimeSavedPopup: React.FC<TimeSavedPopupProps> = ({ itemId, label, qty, onClose }) => {
  const entry = DIY_TIME_SAVINGS[itemId];
  const perPiece = formatHoursRange(estimateTimeSaved({ [itemId]: 1 }));
  const total = estimateTimeSaved(qty);
  const totalPieces = Object.values(qty).reduce((n, v) => n + v, 0);
  const showTotal = totalPieces > 1;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="time-saved-popup"
      className="time-saved-pop relative mt-4 rounded-2xl border-2 border-[#D9A441] bg-[#0E2748] text-white p-4 pr-11 shadow-[0_10px_28px_rgba(14,39,72,0.25)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss time savings note"
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-[#C3CCE0] hover:text-white hover:bg-white/10"
      >
        <X size={16} aria-hidden />
      </button>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-[#D9A441]/15 flex items-center justify-center shrink-0">
          <Clock3 size={20} className="text-[#D9A441]" aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-bold leading-snug m-0">
            {label}: save about <span className="text-[#D9A441]">{perPiece}</span> per piece
          </p>
          <p className="text-sm text-[#C3CCE0] leading-relaxed mt-1 mb-0">
            Building a {entry.example} yourself usually means sorting parts, decoding instructions
            and cleaning up the packaging. We handle all of it.
          </p>
          {showTotal && (
            <p className="text-sm font-semibold mt-2 mb-0">
              Your whole order: <span className="text-[#D9A441]">{formatHoursRange(total)}</span> back in your week.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeSavedPopup;
