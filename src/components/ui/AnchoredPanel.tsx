import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHydrated } from '../../hooks/useHydrated';

/**
 * A dropdown panel that is positioned against a trigger element but always kept
 * inside the viewport.
 *
 * Plain `absolute right-0 w-96` dropdowns break on phones: the trigger sits in
 * the middle of a toolbar, so a panel wider than the space to its left simply
 * runs off the screen edge and the content is unreachable. Rendering into a
 * portal with fixed coordinates also escapes `overflow-x-auto` ancestors, which
 * otherwise clip menus opened from inside scrollable tables.
 */

/** Distance between the trigger and the panel. */
const OFFSET = 8;
/** Minimum space kept between the panel and every viewport edge. */
const GUTTER = 8;
/** Below this much room underneath the trigger, prefer flipping the panel up. */
const FLIP_THRESHOLD = 220;
/** Never collapse the panel to nothing, even in a cramped landscape viewport. */
const MIN_HEIGHT = 140;

// useLayoutEffect warns when it runs during server rendering, and this project
// prerenders with vite-react-ssg.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface PanelPosition {
  left: number;
  width: number;
  maxHeight: number;
  /** Set when the panel hangs below the trigger. */
  top?: number;
  /** Set instead of `top` when the panel is flipped above the trigger. */
  bottom?: number;
}

interface AnchoredPanelProps {
  /** Element the panel is positioned against — usually the trigger button. */
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  /** Preferred width in px. The panel narrows when the viewport cannot fit it. */
  width: number;
  /** Which edge of the panel lines up with the same edge of the anchor. */
  align?: 'left' | 'right';
  /** Preferred max height in px. Always capped to the room actually available. */
  maxHeight?: number;
  /** Dim the page behind the panel on small screens. */
  backdrop?: boolean;
  className?: string;
  children: React.ReactNode;
  role?: string;
  id?: string;
  'aria-label'?: string;
}

function computePosition(
  anchor: HTMLElement,
  width: number,
  align: 'left' | 'right',
  maxHeight: number,
): PanelPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const panelWidth = Math.min(width, viewportWidth - GUTTER * 2);
  const preferredLeft = align === 'right' ? rect.right - panelWidth : rect.left;
  const left = Math.min(
    Math.max(preferredLeft, GUTTER),
    Math.max(viewportWidth - panelWidth - GUTTER, GUTTER),
  );

  const roomBelow = viewportHeight - rect.bottom - OFFSET - GUTTER;
  const roomAbove = rect.top - OFFSET - GUTTER;

  if (roomBelow < FLIP_THRESHOLD && roomAbove > roomBelow) {
    return {
      left,
      width: panelWidth,
      bottom: viewportHeight - rect.top + OFFSET,
      maxHeight: Math.max(Math.min(maxHeight, roomAbove), MIN_HEIGHT),
    };
  }

  return {
    left,
    width: panelWidth,
    top: rect.bottom + OFFSET,
    maxHeight: Math.max(Math.min(maxHeight, roomBelow), MIN_HEIGHT),
  };
}

export default function AnchoredPanel({
  anchorRef,
  open,
  onClose,
  width,
  align = 'right',
  maxHeight = Number.POSITIVE_INFINITY,
  backdrop = false,
  className = '',
  children,
  role,
  id,
  'aria-label': ariaLabel,
}: AnchoredPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const hydrated = useHydrated();

  const reposition = useCallback(() => {
    if (!anchorRef.current) return;
    setPosition(computePosition(anchorRef.current, width, align, maxHeight));
  }, [align, anchorRef, maxHeight, width]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    reposition();

    // `capture` so scrolling any ancestor container moves the panel too, not
    // just the document.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);

    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // The trigger toggles itself on click; closing here would reopen it.
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || !hydrated || !position) return null;

  return createPortal(
    <>
      {backdrop && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 sm:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <div
        ref={panelRef}
        id={id}
        role={role}
        aria-label={ariaLabel}
        className={`fixed z-50 flex flex-col overflow-hidden overscroll-contain ${className}`}
        style={{
          left: position.left,
          top: position.top,
          bottom: position.bottom,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
