import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBuildyEvents } from '../../hooks/useBuildyEvents';
import {
  paceFor,
  pokeLine,
  REACTION_MS,
  seasonalLook,
  timeOfDayProp,
  enqueueReaction,
  type BuildyReaction,
  type JobBoardSummary,
} from '../../utils/buildy';
import './BuildyRail.css';

/** Four is all that fits under an 80px rail; the label still names the real number. */
const MAX_BOXES_SHOWN = 4;
/** Where the load stops being comfortable and the tower starts to sway. */
const HEAVY_LOAD = 5;

/** Hand-stacked, not machine-stacked. */
const BOX_TILTS = ['0deg', '-2deg', '1.5deg', '-1deg'];

/** Seconds to cross the rail. A packed day and he hurries. */
const WALK_SECONDS = { normal: 20, busy: 12 } as const;
/** Width of the walker box, which starts just off the left edge. */
const WALKER_WIDTH = 70;
/** Keep him fully on screen while he reacts; he only moves if he was half off an edge. */
const HOLD_EDGE = 8;
/**
 * Speech bubbles open behind him (to his left) unless there is more room
 * ahead. These are where the bubble's edge sits, in px from the walker's left.
 */
const BUBBLE_LEFT_EDGE = 28;
const BUBBLE_RIGHT_EDGE = 14;
/** Room a typical line needs; with more than this behind him he never flips. */
const BUBBLE_ROOM = 200;
/** How far a box has to be dragged before letting go counts as a drop. */
const DRAG_DROP_DISTANCE = 28;
/** Movement under this is still a click, not a drag. */
const DRAG_START_DISTANCE = 6;

interface BuildyRailProps {
  businessId: string | null;
  board: JobBoardSummary;
}

interface Hold {
  /** Where he stands, in px from the rail's left edge. */
  left: number;
  /** Open the speech bubble ahead of him instead of behind. */
  bubbleRight: boolean;
  /** The widest the bubble can be without running off the rail. */
  bubbleRoom: number;
}

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

/**
 * The mascot rail: a strip along the bottom of the admin shell with a figure
 * walking it, carrying one box for every job on the board.
 *
 * He reacts to the business as it happens — a new lead, a paid invoice, a job
 * signed off — and to the person using the app: poke him and he talks back,
 * hover and he stops to look at you, drag a box off his stack and it opens the
 * next job. He dresses for the season, carries what fits the time of day,
 * hurries on a packed day and naps through an empty week.
 *
 * None of it is required. Everything he says also goes to a polite live
 * region, every shortcut has a plain link, and reduced-motion users get the
 * same information standing still.
 */
export default function BuildyRail({ businessId, board }: BuildyRailProps) {
  const navigate = useNavigate();
  const railRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);

  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // The reaction queue. Mirrored in a ref so the handlers below can act on the
  // current queue without waiting for a render.
  const [queue, setQueue] = useState<BuildyReaction[]>([]);
  const queueRef = useRef<BuildyReaction[]>([]);
  // Where he is standing while he reacts; null while he walks.
  const [hold, setHold] = useState<Hold | null>(null);
  const holdRef = useRef<Hold | null>(null);
  // Negative delay that resumes the walk from where he stopped.
  const [resumeDelay, setResumeDelay] = useState(0);
  const [pokes, setPokes] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  // No reason to animate a tab nobody is looking at.
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Coffee, lunch, headlamp and the seasonal outfit all follow the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const count = Math.max(0, Math.floor(board.upcoming));
  const shown = Math.min(count, MAX_BOXES_SHOWN);
  const notShown = count - shown;
  const heavy = count >= HEAVY_LOAD;
  const pace = paceFor(board);
  const walkSeconds = pace === 'busy' ? WALK_SECONDS.busy : WALK_SECONDS.normal;
  const walkSecondsRef = useRef(walkSeconds);
  useEffect(() => {
    walkSecondsRef.current = walkSeconds;
  }, [walkSeconds]);

  const prop = timeOfDayProp(now);
  const look = seasonalLook(now);
  const current = queue[0] ?? null;

  // ── stopping and starting the walk ──────────────────────────────────────

  const beginHold = useCallback(() => {
    const rail = railRef.current;
    const walker = walkerRef.current;
    if (!rail || !walker) return;
    const railBox = rail.getBoundingClientRect();
    const at = walker.getBoundingClientRect().left - railBox.left;
    const max = Math.max(HOLD_EDGE, railBox.width - WALKER_WIDTH - HOLD_EDGE);
    const left = Math.round(Math.min(Math.max(at, HOLD_EDGE), max));
    const roomBehind = left + BUBBLE_LEFT_EDGE;
    const roomAhead = railBox.width - left - BUBBLE_RIGHT_EDGE;
    const bubbleRight = roomBehind < BUBBLE_ROOM && roomAhead > roomBehind;
    const held = { left, bubbleRight, bubbleRoom: Math.round((bubbleRight ? roomAhead : roomBehind) - 8) };
    holdRef.current = held;
    setHold(held);
  }, []);

  const endHold = useCallback(() => {
    const held = holdRef.current;
    holdRef.current = null;
    setHold(null);
    const railWidth = railRef.current?.getBoundingClientRect().width;
    if (held && railWidth) {
      // Pick the walk back up from where he stood instead of starting over.
      const progress = (held.left + WALKER_WIDTH) / (railWidth + WALKER_WIDTH);
      setResumeDelay(-progress * walkSecondsRef.current);
    }
  }, []);

  const addReaction = useCallback(
    (reaction: BuildyReaction) => {
      const next = enqueueReaction(queueRef.current, reaction);
      if (next === queueRef.current) return;
      queueRef.current = next;
      setQueue(next);
      if (!holdRef.current) beginHold();
    },
    [beginHold],
  );

  const finishCurrent = useCallback(() => {
    const next = queueRef.current.slice(1);
    queueRef.current = next;
    setQueue(next);
    if (next.length === 0) endHold();
  }, [endHold]);

  useBuildyEvents(businessId, addReaction);

  // Each reaction holds the stage for its time, but the clock only runs while
  // the tab is visible so nothing is missed in a background tab.
  const currentKey = current?.key;
  const currentKind = current?.kind;
  useEffect(() => {
    if (!currentKind || paused) return;
    const id = setTimeout(finishCurrent, REACTION_MS[currentKind]);
    return () => clearTimeout(id);
  }, [currentKey, currentKind, paused, finishCurrent]);

  // ── poking ──────────────────────────────────────────────────────────────

  const poke = () => {
    addReaction({ key: `poke:${pokes}`, kind: 'poke', text: pokeLine(board, pokes) });
    setPokes((n) => n + 1);
  };

  // ── looking at the cursor ───────────────────────────────────────────────

  const lookAt = (event: PointerEvent<HTMLDivElement>) => {
    const walker = walkerRef.current;
    if (!walker || event.pointerType === 'touch') return;
    const box = walker.getBoundingClientRect();
    // The head sits 21px in and 36px up from the bottom of the walker box.
    const dx = event.clientX - (box.left + 21);
    const dy = event.clientY - (box.bottom - 36);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v / 40));
    walker.style.setProperty('--by-look-x', `${clamp(dx) * 1.2}px`);
    walker.style.setProperty('--by-look-y', `${clamp(dy) * 0.8}px`);
  };

  const lookAway = () => {
    walkerRef.current?.style.setProperty('--by-look-x', '0px');
    walkerRef.current?.style.setProperty('--by-look-y', '0px');
  };

  // ── dragging a box off the stack ────────────────────────────────────────

  const canDrag = shown > 0 && !!board.nextJobId;

  const onBoxDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false });
  };

  const onBoxMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    setDrag({ ...drag, x: event.clientX, y: event.clientY, active: drag.active || moved > DRAG_START_DISTANCE });
  };

  const onBoxUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    setDrag(null);
    if (drag.active && moved > DRAG_DROP_DISTANCE && board.nextJobId) {
      navigate(`/admin/jobs?job=${encodeURIComponent(board.nextJobId)}`);
    }
  };

  // ── drawing ─────────────────────────────────────────────────────────────

  const label =
    count === 0 ? 'No jobs on the board' : count === 1 ? '1 job on the board' : `${count} jobs on the board`;

  // With boxes he jumps when poked; with empty hands he waves.
  const pokeMove = shown > 0 ? 'jump' : 'wave';
  const napping = pace === 'nap' && !current;
  const dragging = !!drag?.active;

  const railClass = [
    'by-rail',
    paused && 'by-rail--paused',
    hold && 'by-rail--holding',
    dragging && 'by-rail--dragging',
    pace === 'busy' && 'by-rail--busy',
    pace === 'nap' && 'by-rail--nap',
    napping && 'by-rail--asleep',
    look && `by-rail--${look}`,
    current && `by-rail--react-${current.kind === 'poke' ? pokeMove : current.kind}`,
  ]
    .filter(Boolean)
    .join(' ');

  const bubbleSide = hold?.bubbleRight ? ' by-bubble--right' : '';

  const walkerStyle: CSSProperties = hold
    ? ({ animation: 'none', left: hold.left, '--by-bubble-max': `${hold.bubbleRoom}px` } as CSSProperties)
    : { animationDuration: `${walkSeconds}s`, animationDelay: `${resumeDelay}s` };

  const propEl =
    prop === 'coffee' ? (
      <div className="by-coffee">
        <div className="by-coffee-steam" />
      </div>
    ) : prop === 'lunch' ? (
      <div className="by-lunch" />
    ) : null;

  return (
    <div ref={railRef} className={railClass} onPointerMove={lookAt} onPointerLeave={lookAway}>
      <div className="by-floor" />

      <div ref={walkerRef} className="by-walker" style={walkerStyle}>
        <div className="by-shadow" />
        <div className="by-body" aria-hidden="true">
          <div className="by-leg by-leg--back" />
          <div className="by-leg by-leg--front" />
          <div className="by-torso" />
          <div className="by-belt" />
          <div className="by-badge">2</div>
          <div className="by-head" />
          <div className="by-cap" />
          <div className="by-brim" />
          {look === 'santa' && <div className="by-pompom" />}
          {prop === 'headlamp' && (
            <>
              <div className="by-lamp" />
              <div className="by-beam" />
            </>
          )}
          <div className="by-eyes">
            {look === 'shades' ? (
              <div className="by-shades" />
            ) : (
              <>
                <div className="by-eye by-eye--far" />
                <div className="by-eye by-eye--near" />
              </>
            )}
          </div>
          <div className="by-mouth" />
          <div className="by-arm" />

          {pace === 'busy' && (
            <>
              <div className="by-sweat by-sweat--one" />
              <div className="by-sweat by-sweat--two" />
            </>
          )}

          {napping && (
            <div className="by-zzz">
              <span>z</span>
              <span>z</span>
              <span>z</span>
            </div>
          )}

          {count === 0 && !propEl && (
            <>
              <div className="by-key-long" />
              <div className="by-key-short" />
            </>
          )}

          {count === 0 && propEl && <div className="by-hand-prop">{propEl}</div>}

          {shown > 0 && (
            <div className={`by-stack${heavy ? ' by-stack--heavy' : ''}`}>
              {Array.from({ length: shown }, (_, i) => {
                const top = i === shown - 1;
                const pumpkin = top && look === 'pumpkin';
                return (
                  <div
                    key={i}
                    className={[
                      'by-box',
                      pumpkin && 'by-box--pumpkin',
                      top && canDrag && 'by-box--grab',
                      top && dragging && 'by-box--lifted',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ transform: `rotate(${BOX_TILTS[i % BOX_TILTS.length]})` }}
                    title={top && canDrag ? 'Drag me off to open the next job' : undefined}
                    onPointerDown={top ? onBoxDown : undefined}
                    onPointerMove={top ? onBoxMove : undefined}
                    onPointerUp={top ? onBoxUp : undefined}
                    onPointerCancel={top ? () => setDrag(null) : undefined}
                  >
                    {pumpkin ? (
                      <div className="by-pumpkin-stem" />
                    ) : (
                      <>
                        <div className="by-box-seam" />
                        <div className="by-box-tape" />
                      </>
                    )}
                  </div>
                );
              })}
              {propEl}
            </div>
          )}

          {notShown > 0 && <div className="by-overflow">+{notShown}</div>}

          {current?.kind === 'paid' && <div key={current.key} className="by-coin" />}

          {current?.kind === 'done' && (
            <div key={current.key} className="by-unpack">
              <div className="by-unpack-box">
                <div className="by-flap by-flap--left" />
                <div className="by-flap by-flap--right" />
              </div>
              <div className="by-chair">
                <div className="by-chair-back" />
                <div className="by-chair-seat" />
                <div className="by-chair-leg by-chair-leg--front" />
                <div className="by-chair-leg by-chair-leg--back" />
              </div>
            </div>
          )}
        </div>

        <button type="button" className="by-poke" aria-label="Say hi to Buildy" onClick={poke} />

        {current &&
          (current.href ? (
            <Link
              key={current.key}
              to={current.href}
              className={`by-bubble by-bubble--${current.kind} by-bubble--link${bubbleSide}`}
              onClick={finishCurrent}
            >
              <span className="by-bubble-text">{current.text}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <div key={current.key} className={`by-bubble by-bubble--${current.kind}${bubbleSide}`} aria-hidden="true">
              <span className="by-bubble-text">{current.text}</span>
            </div>
          ))}
      </div>

      {dragging && drag && (
        <div className="by-drag-box" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <div className="by-box-seam" />
          <div className="by-box-tape" />
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {current?.text ?? ''}
      </div>

      <Link to="/admin/jobs" className="by-label">
        {label.toUpperCase()}
      </Link>
    </div>
  );
}
