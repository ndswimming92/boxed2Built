import React, { useEffect, useState } from 'react';

interface NewsScrollBarProps {
  /** Element wrapping the story cards; each card carries `data-news-card`. */
  listRef: React.RefObject<HTMLElement>;
  /** Stories in the feed overall (loaded or not), when known. */
  total: number | null;
  /** Stories loaded on the page so far. */
  loaded: number;
}

/**
 * A slim vertical bar fixed to the right edge. The fill shows how far down the
 * feed the visitor has scrolled; the label says which story they are on out of
 * how many there are.
 */
const NewsScrollBar: React.FC<NewsScrollBarProps> = ({ listRef, total, loaded }) => {
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState(true);

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

      // Hide once the last card is fully on screen; it returns on scroll up.
      const last = cards[cards.length - 1];
      setVisible(!last || last.getBoundingClientRect().bottom > viewport);
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
      className={`hidden md:flex fixed right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30 h-[50vh] flex-col items-center gap-2 text-xs text-gray-600 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
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
