import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesTopology from 'us-atlas/states-10m.json';
import type { SaleSubscriber } from '../../types/saleSubscriber';
import {
  clusterSubscribers,
  isInTennessee,
  isPlaced,
  placeLabel,
  summarize,
  timeAgo,
} from '../../utils/subscriberMap';

const WIDTH = 960;
const HEIGHT = 500;
const TENNESSEE_FIPS = '47';
const FEED_SIZE = 8;
const JUST_JOINED_MS = 24 * 60 * 60 * 1000;

type View = 'tn' | 'us';

interface Props {
  subscribers: SaleSubscriber[];
  /** When the list was last fetched, for the "updated" readout. */
  updatedAt: number | null;
}

const states = (() => {
  const topology = statesTopology as unknown as Topology;
  return feature(topology, topology.objects.states as GeometryCollection) as FeatureCollection<
    Geometry,
    { name: string }
  >;
})();
const tennessee = states.features.find((f) => String(f.id) === TENNESSEE_FIPS)!;

/** Counts up to `target` so a new subscriber visibly ticks the total. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const start = from.current;
    if (start === target || reduceMotion) return;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 700);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(start + (target - start) * eased);
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  return reduceMotion ? target : value;
}

/** Re-renders every 30 seconds so "5m ago" keeps moving. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function SubscriberMap({ subscribers, updatedAt }: Props) {
  const [view, setView] = useState<View>('tn');
  const now = useNow();

  const summary = useMemo(() => summarize(subscribers, now), [subscribers, now]);
  const clusters = useMemo(() => clusterSubscribers(subscribers), [subscribers]);
  const total = useCountUp(summary.total);

  const feed = useMemo(
    () =>
      subscribers
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.subscribed_at.localeCompare(a.subscribed_at))
        .slice(0, FEED_SIZE),
    [subscribers],
  );

  // Rows that were not in the previous refresh glow in the feed.
  const seenIds = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(subscribers.map((s) => s.id));
    if (seenIds.current) {
      const added = new Set([...ids].filter((id) => !seenIds.current!.has(id)));
      if (added.size > 0) {
        setFresh(added);
        const timer = setTimeout(() => setFresh(new Set()), 6000);
        seenIds.current = ids;
        return () => clearTimeout(timer);
      }
    }
    seenIds.current = ids;
  }, [subscribers]);

  const { projection, outlines } = useMemo(() => {
    const proj =
      view === 'tn'
        ? geoMercator().fitExtent(
            [
              [70, 40],
              [WIDTH - 70, HEIGHT - 40],
            ],
            tennessee,
          )
        : geoAlbersUsa().fitExtent(
            [
              [20, 20],
              [WIDTH - 20, HEIGHT - 20],
            ],
            states,
          );
    const path = geoPath(proj);
    return {
      projection: proj,
      outlines: states.features.map((f) => ({
        id: String(f.id),
        d: path(f) ?? '',
        isTn: String(f.id) === TENNESSEE_FIPS,
      })),
    };
  }, [view]);

  const dots = useMemo(
    () =>
      clusters
        // The Tennessee view draws Tennessee by state. Without this, Kentucky or
        // Alabama sign-ups near the border land inside the rectangle and get drawn.
        .filter((cluster) => view === 'us' || cluster.inTennessee)
        .map((cluster) => {
          const point = projection([cluster.longitude, cluster.latitude]);
          if (!point) return null;
          const [x, y] = point;
          if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return null;
          return { ...cluster, x, y, radius: Math.min(16, 4 + Math.sqrt(cluster.count) * 2.2) };
        })
        .filter((dot): dot is NonNullable<typeof dot> => dot !== null),
    [clusters, projection, view],
  );

  const hidden = summary.total - summary.unknown - dots.reduce((sum, dot) => sum + dot.count, 0);
  const viewLabel = view === 'tn' ? 'Tennessee' : 'the US';

  return (
    <section
      aria-label="Subscriber map"
      className="subscriber-map relative mb-6 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#050b17] text-slate-100 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]"
    >
      <style>{`
        @keyframes sm-ping { 0% { transform: scale(1); opacity: .7 } 80%,100% { transform: scale(3.2); opacity: 0 } }
        @keyframes sm-flash { 0% { background-color: rgba(34,211,238,.35) } 100% { background-color: transparent } }
        @keyframes sm-scan { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }
        @keyframes sm-blink { 50% { opacity: .25 } }
        .sm-ping { transform-box: fill-box; transform-origin: center; animation: sm-ping 2.2s ease-out infinite }
        .sm-flash { animation: sm-flash 6s ease-out 1 }
        .sm-scan { animation: sm-scan 7s linear infinite }
        .sm-blink { animation: sm-blink 1.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .sm-ping, .sm-scan, .sm-blink, .sm-flash { animation: none } }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-400/10 px-5 py-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300">
            <span className="sm-blink inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" aria-hidden="true" />
            Live subscribers
            {updatedAt && (
              <span className="normal-case tracking-normal text-slate-500">
                &middot; synced {timeAgo(new Date(updatedAt).toISOString(), now)}
              </span>
            )}
          </p>
          <p className="mt-1 flex items-baseline gap-3">
            <span
              className="font-mono text-5xl font-bold tabular-nums text-white drop-shadow-[0_0_14px_rgba(34,211,238,0.7)]"
              aria-label={`${summary.total} subscribers`}
            >
              {total.toLocaleString('en-US')}
            </span>
            <span className="text-sm text-slate-400">
              subscriber{summary.total === 1 ? '' : 's'}
              {summary.today > 0 && <span className="ml-2 font-semibold text-emerald-400">+{summary.today} today</span>}
            </span>
          </p>
        </div>

        <div className="flex rounded-lg border border-cyan-400/20 bg-black/30 p-0.5 font-mono text-xs" role="group" aria-label="Map area">
          {(['tn', 'us'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`rounded-md px-4 py-1.5 uppercase tracking-widest transition-colors ${
                view === option
                  ? 'bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {option === 'tn' ? 'Tennessee' : 'US'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="relative flex items-center">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Map of ${viewLabel} showing where subscribers are`}
            className="block h-auto w-full"
          >
            <defs>
              <pattern id="sm-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="1" />
              </pattern>
              <radialGradient id="sm-vignette" cx="50%" cy="50%" r="70%">
                <stop offset="60%" stopColor="rgba(5,11,23,0)" />
                <stop offset="100%" stopColor="rgba(5,11,23,0.85)" />
              </radialGradient>
              <filter id="sm-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={WIDTH} height={HEIGHT} fill="url(#sm-grid)" />

            <g>
              {outlines.map((state) => (
                <path
                  key={state.id}
                  d={state.d}
                  fill={state.isTn ? 'rgba(34,211,238,0.10)' : 'rgba(30,58,95,0.28)'}
                  stroke={state.isTn ? 'rgba(103,232,249,0.9)' : 'rgba(56,189,248,0.28)'}
                  strokeWidth={state.isTn ? 1.6 : 0.7}
                  strokeLinejoin="round"
                  filter={state.isTn ? 'url(#sm-glow)' : undefined}
                />
              ))}
            </g>

            <g>
              {dots.map((dot) => {
                const recent = now - dot.latest < JUST_JOINED_MS;
                const color = recent ? '#34d399' : '#22d3ee';
                return (
                  <g key={dot.key}>
                    <title>{`${dot.label}: ${dot.count} subscriber${dot.count === 1 ? '' : 's'}`}</title>
                    {recent && <circle className="sm-ping" cx={dot.x} cy={dot.y} r={dot.radius} fill="none" stroke={color} strokeWidth="1.5" />}
                    <circle cx={dot.x} cy={dot.y} r={dot.radius * 1.9} fill={color} opacity="0.12" />
                    <circle cx={dot.x} cy={dot.y} r={dot.radius} fill={color} opacity="0.85" filter="url(#sm-glow)" />
                    <circle cx={dot.x} cy={dot.y} r={Math.max(1.5, dot.radius * 0.35)} fill="#ffffff" />
                    {dot.count > 1 && dot.radius >= 8 && (
                      <text x={dot.x} y={dot.y - dot.radius - 5} textAnchor="middle" className="fill-cyan-100 font-mono" fontSize="11" fontWeight="700">
                        {dot.count}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            <rect width={WIDTH} height={HEIGHT} fill="url(#sm-vignette)" pointerEvents="none" />
          </svg>

          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="sm-scan h-1/3 w-full bg-gradient-to-b from-transparent via-cyan-400/[0.06] to-transparent" />
          </div>

          {summary.total > 0 && dots.length === 0 && (
            <p className="absolute inset-x-0 bottom-4 text-center font-mono text-xs text-slate-500">
              No located subscribers in view yet. New sign-ups appear here as they arrive.
            </p>
          )}
        </div>

        <aside className="border-t border-cyan-400/10 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-px bg-cyan-400/10 font-mono text-center">
            {[
              { label: 'Tennessee', value: summary.inTennessee },
              { label: 'Elsewhere', value: summary.elsewhere },
              { label: 'Unknown', value: summary.unknown },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#050b17] px-2 py-3">
                <p className="text-xl font-bold tabular-nums text-cyan-200">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <p className="border-t border-cyan-400/10 px-4 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Latest sign-ups
          </p>
          {feed.length === 0 ? (
            <p className="px-4 pb-5 text-sm text-slate-500">Nobody yet. The first sign-up lights up the map.</p>
          ) : (
            <ul className="pb-2">
              {feed.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2 ${fresh.has(s.id) ? 'sm-flash' : ''}`}
                >
                  <span
                    className={`h-2 w-2 flex-none rounded-full ${
                      isPlaced(s) ? (isInTennessee(s) ? 'bg-cyan-300 shadow-[0_0_6px_#67e8f9]' : 'bg-sky-400') : 'bg-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{s.name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{isPlaced(s) ? placeLabel(s) : 'Location unknown'}</p>
                  </div>
                  <span className="flex-none font-mono text-[11px] text-slate-500">{timeAgo(s.subscribed_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <p className="border-t border-cyan-400/10 px-5 py-2 font-mono text-[10px] text-slate-600">
        Locations are approximate (city level, from the IP address at sign-up). Phones and VPNs can show the wrong city.
        {hidden > 0 && view === 'tn' ? ` ${hidden} located outside Tennessee, not drawn here.` : ''}
        {hidden > 0 && view === 'us' ? ` ${hidden} located outside the map area.` : ''}
      </p>
    </section>
  );
}
