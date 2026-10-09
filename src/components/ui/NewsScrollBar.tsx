import React, { useEffect, useState } from 'react';

const HEADER_OFFSET = 140;
const BOTTOM_MARGIN = 16;

interface NewsScrollBarProps {
  /** Element wrapping the story cards; each card carries `data-news-card`. */
  listRef: React.RefObject<HTMLElement>;
  /** Stories in the feed overall (loaded or not), when known. */
  total: number | null;
  /** Stories loaded on the page so far. */
  loaded: number;
}

/**
 * A slim vertical bar fixed just right of the story column. The fill shows how far down the
 * feed the visitor has scrolled; the label says which story they are on out of
 * how many there are.
 */
const NewsScrollBar: React.FC<NewsScrollBarProps> = ({ listRef, total, loaded }) => {
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState(false);
  const [span, setSpan] = useState({ top: 0, height: 0 });

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const list = listRef.current;
      if (!list) return;

      const rect = list.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrollable = rect.height - viewport * 0.6;
      const scrolled = viewport * 0.4 - rect.top;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, scrolled / scrollable)) : 1);

      // The story under the middle of the screen is the one being read.
      const cards = list.querySelectorAll('[data-news-card]');
      let index = 1;
      cards.forEach((card, i) => {
        if (card.getBoundingClientRect().top <= viewport * 0.5) index = i + 1;
      });
      setCurrent(index);

      // The bar runs from the first card to the last card, clamped to the area below the
      // sticky header and above the bottom edge. It only shows while that span is on screen.
      const first = cards[0];
      const last = cards[cards.length - 1];
      if (!first || !last) {
        setVisible(false);
        return;
      }
      const firstTop = first.getBoundingClientRect().top;
      const lastBottom = last.getBoundingClientRect().bottom;
      const top = Math.max(HEADER_OFFSET, firstTop);
      const bottom = Math.min(viewport - BOTTOM_MARGIN, lastBottom);
      const height = bottom - top;
      setSpan({ top, height: Math.max(0, height) });
      setVisible(firstTop < viewport - BOTTOM_MARGIN && height > 80);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [listRef, loaded]);

  if (loaded === 0) return null;

  const count = total ?? loaded;
  const percent = Math.round(progress * 100);

  return (
    <div
      aria-hidden={!visible}
      className={`hidden md:flex fixed right-[max(1rem,calc(50%-26.5rem))] z-30 flex-col items-center gap-2 text-xs text-gray-600 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ top: span.top, height: span.height }}
      role="progressbar"
      aria-label="Scroll progress through news"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`Story ${Math.min(current, count)} of ${count}`}
    >
      <span className="font-semibold tabular-nums text-blue-800">{Math.min(current, count)}</span>
      <div className="relative w-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 rounded-full bg-blue-700"
          style={{ height: `${percent}%` }}
        />
      </div>
      <span className="tabular-nums">{count}</span>
    </div>
  );
};

export default NewsScrollBar;
