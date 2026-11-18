import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './BuildyRail.css';

/** Four is all that fits under an 80px rail; the label still names the real number. */
const MAX_BOXES_SHOWN = 4;
/** Where the load stops being comfortable and the tower starts to sway. */
const HEAVY_LOAD = 5;

/** Hand-stacked, not machine-stacked. */
const BOX_TILTS = ['0deg', '-2deg', '1.5deg', '-1deg'];

interface BuildyRailProps {
  /** Jobs scheduled for today or later and still ahead of us. */
  jobCount: number;
}

/**
 * The mascot rail: a strip along the bottom of the admin shell with a figure
 * walking it, carrying one box for every job on the board.
 *
 * He is decoration with one job — making the upcoming count something you see
 * rather than something you go and look up. So the figure is aria-hidden and
 * the count is a real link next to it, and nothing here ever needs a click.
 */
export default function BuildyRail({ jobCount }: BuildyRailProps) {
  const [paused, setPaused] = useState(false);

  // No reason to animate a tab nobody is looking at.
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const count = Math.max(0, Math.floor(jobCount));
  const shown = Math.min(count, MAX_BOXES_SHOWN);
  const notShown = count - shown;
  const heavy = count >= HEAVY_LOAD;

  const label =
    count === 0 ? 'No jobs on the board' : count === 1 ? '1 job on the board' : `${count} jobs on the board`;

  return (
    <div className={`by-rail${paused ? ' by-rail--paused' : ''}`}>
      <div className="by-floor" />

      <div className="by-walker" aria-hidden="true">
        <div className="by-shadow" />
        <div className="by-body">
          <div className="by-leg by-leg--back" />
          <div className="by-leg by-leg--front" />
          <div className="by-torso" />
          <div className="by-belt" />
          <div className="by-head" />
          <div className="by-cap" />
          <div className="by-brim" />
          <div className="by-eye by-eye--far" />
          <div className="by-eye by-eye--near" />
          <div className="by-mouth" />
          <div className="by-arm" />

          {count === 0 && (
            <>
              <div className="by-key-long" />
              <div className="by-key-short" />
            </>
          )}

          {shown > 0 && (
            <div className={`by-stack${heavy ? ' by-stack--heavy' : ''}`}>
              {Array.from({ length: shown }, (_, i) => (
                <div key={i} className="by-box" style={{ transform: `rotate(${BOX_TILTS[i % BOX_TILTS.length]})` }}>
                  <div className="by-box-seam" />
                  <div className="by-box-tape" />
                </div>
              ))}
            </div>
          )}

          {notShown > 0 && <div className="by-overflow">+{notShown}</div>}
        </div>
      </div>

      <Link to="/admin/jobs" className="by-label">
        {label.toUpperCase()}
      </Link>
    </div>
  );
}
