import React, { useEffect, useRef, useState } from 'react';
import './BoxLoader.css';

interface BoxLoaderProps {
  /** Minimum time the loader stays fully visible before fading out */
  minDurationMs?: number;
  showSparkles?: boolean;
  tagline?: string;
  onDone?: () => void;
}

const SPARKLES = [
  { left: 'calc(50% - 38px)', top: '-6px', size: 8, color: '#D9A441', delay: '1.3s' },
  { left: 'calc(50% - 14px)', top: '-14px', size: 6, color: '#0E2748', delay: '1.45s' },
  { left: 'calc(50% + 4px)', top: '-8px', size: 10, color: '#D9A441', delay: '1.38s' },
  { left: 'calc(50% + 26px)', top: '-12px', size: 6, color: '#D9A441', delay: '1.55s' },
  { left: 'calc(50% + 42px)', top: '-4px', size: 7, color: '#0E2748', delay: '1.65s' },
];

const BoxLoader: React.FC<BoxLoaderProps> = ({
  minDurationMs = 3000,
  showSparkles = true,
  tagline = 'We assemble. You enjoy.',
  onDone,
}) => {
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setDone(true);
      onDoneRef.current?.();
    }, minDurationMs);
    const hideTimer = setTimeout(() => setHidden(true), minDurationMs + 750);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [minDurationMs]);

  if (hidden) return null;

  return (
    <div
      className={`bl-overlay${done ? ' bl-overlay--done' : ''}`}
      role="status"
      aria-label="Loading Boxed2Built"
    >
      <div className="bl-box-wrap">
        <div className="bl-perspective">
          <div className="bl-box">
            <div className="bl-face bl-face--bottom" />
            <div className="bl-face bl-face--back">
              <div className="bl-flap bl-flap--back">
                <div className="bl-tape" />
              </div>
            </div>
            <div className="bl-face bl-face--left">
              <div className="bl-flap bl-flap--left" />
            </div>
            <div className="bl-face bl-face--right">
              <div className="bl-flap bl-flap--right" />
            </div>
            <div className="bl-face bl-face--front">
              <div className="bl-flap bl-flap--front">
                <div className="bl-tape" />
              </div>
              <div className="bl-logo-wrap">
                <img src="/boxed2built_logo.png" className="bl-logo" alt="Boxed2Built" />
              </div>
            </div>
          </div>
        </div>
        <div className="bl-shadow" />
        {showSparkles &&
          SPARKLES.map((s, i) => (
            <div
              key={i}
              className="bl-spark"
              style={{
                left: s.left,
                top: s.top,
                width: `${s.size}px`,
                height: `${s.size}px`,
                background: s.color,
                animationDelay: s.delay,
              }}
            />
          ))}
        <div className="bl-tagline">{tagline}</div>
      </div>
    </div>
  );
};

export default BoxLoader;
