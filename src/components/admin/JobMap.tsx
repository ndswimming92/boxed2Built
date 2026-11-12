import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { geoCircle, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesTopology from 'us-atlas/states-10m.json';
import countiesData from '../../data/tennesseeCounties.json';
import type { JobMapOrigin } from '../../services/jobMapService';
import {
  HEAT_STOPS,
  focusBounds,
  heatColor,
  inBounds,
  jobPrice,
  priceSurface,
  spreadDots,
  streetLine,
  summarizeSites,
  type HeatMode,
  type JobSite,
} from '../../utils/jobMap';
import { timeAgo } from '../../utils/subscriberMap';

const WIDTH = 960;
const HEIGHT = 500;
const TENNESSEE_FIPS = '47';
const MILES_PER_DEGREE_LAT = 69.17;
const RING_MILES = [10, 20, 30];

type View = 'area' | 'tn';
type Heat = HeatMode | 'off';

interface Props {
  sites: JobSite[];
  /** Completed jobs that could not be drawn: no address saved, or address not found. */
  notMapped: number;
  origin: JobMapOrigin | null;
  updatedAt: number | null;
  /** e.g. "Locating 2 of 5 addresses". */
  status: string | null;
  /** Formats a dollar amount, masked when privacy mode is on. */
  money: (amount: number) => string;
}

const states = (() => {
  const topology = statesTopology as unknown as Topology;
  return feature(topology, topology.objects.states as GeometryCollection) as FeatureCollection<
    Geometry,
    { name: string }
  >;
})();
const tennessee = states.features.find((f) => String(f.id) === TENNESSEE_FIPS)!;
const counties = countiesData as unknown as FeatureCollection<Geometry, { name: string }>;

/** Reference points so the map reads as a place. `major` towns also show on the statewide view. */
const TOWNS: Array<{ name: string; latitude: number; longitude: number; major?: boolean }> = [
  { name: 'Nashville', latitude: 36.1627, longitude: -86.7816, major: true },
  { name: 'Memphis', latitude: 35.1495, longitude: -90.049, major: true },
  { name: 'Knoxville', latitude: 35.9606, longitude: -83.9207, major: true },
  { name: 'Chattanooga', latitude: 35.0456, longitude: -85.3097, major: true },
  { name: 'Clarksville', latitude: 36.5298, longitude: -87.3595, major: true },
  { name: 'Jackson', latitude: 35.6145, longitude: -88.8139, major: true },
  { name: 'Murfreesboro', latitude: 35.8456, longitude: -86.3903, major: true },
  { name: 'Spring Hill', latitude: 35.7512, longitude: -86.93 },
  { name: 'Franklin', latitude: 35.9251, longitude: -86.8689 },
  { name: "Thompson's Station", latitude: 35.802, longitude: -86.9114 },
  { name: 'Columbia', latitude: 35.6151, longitude: -87.0353 },
  { name: 'Brentwood', latitude: 36.0331, longitude: -86.7828 },
  { name: 'Nolensville', latitude: 35.9526, longitude: -86.6689 },
  { name: 'Mount Pleasant', latitude: 35.5359, longitude: -87.2003 },
  { name: 'Chapel Hill', latitude: 35.6317, longitude: -86.6939 },
  { name: 'Lewisburg', latitude: 35.4492, longitude: -86.7889 },
  { name: 'Smyrna', latitude: 35.9828, longitude: -86.5186 },
  { name: 'Fairview', latitude: 35.982, longitude: -87.1214 },
  { name: 'Dickson', latitude: 36.077, longitude: -87.3878 },
  { name: 'Shelbyville', latitude: 35.4834, longitude: -86.4603 },
  { name: 'Pulaski', latitude: 35.1998, longitude: -87.0308 },
  { name: 'Lawrenceburg', latitude: 35.2423, longitude: -87.3347 },
  { name: 'Centerville', latitude: 35.779, longitude: -87.467 },
];

const HEAT_GRADIENT = `linear-gradient(to right, ${HEAT_STOPS.map(
  ([stop, [r, g, b]]) => `rgb(${r},${g},${b}) ${stop * 100}%`,
).join(', ')})`;

/** Re-renders every 30 seconds so "5m ago" keeps moving. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** 'YYYY-MM-DD' as a local date, so an evening viewer does not see the day before. */
function formatJobDate(value: string | null): string {
  if (!value) return 'No date';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDrive(site: JobSite): string | null {
  if (site.driveSeconds == null) return null;
  const minutes = Math.max(1, Math.round(site.driveSeconds / 60));
  const miles = site.distanceMiles != null ? ` · ${site.distanceMiles.toFixed(1)} mi` : '';
  return `${minutes} min drive${miles}`;
}

function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <div className="flex rounded-lg border border-cyan-400/20 bg-black/30 p-0.5 font-mono text-xs" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 uppercase tracking-widest transition-colors ${
              value === option.value
                ? 'bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function JobMap({ sites, notMapped, origin, updatedAt, status, money }: Props) {
  const [view, setView] = useState<View>('area');
  const [heat, setHeat] = useState<Heat>('avg');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const now = useNow();

  const summary = useMemo(() => summarizeSites(sites), [sites]);
  const selected = sites.find((site) => site.key === selectedKey) ?? null;

  const bounds = useMemo(() => focusBounds(origin ? [...sites, origin] : sites), [sites, origin]);
  // With nothing located yet there is no area to zoom to, so show the state.
  const activeView: View = view === 'area' && bounds ? 'area' : 'tn';

  const map = useMemo(() => {
    const projection =
      activeView === 'area' && bounds
        ? geoMercator().fitExtent(
            [
              [50, 40],
              [WIDTH - 50, HEIGHT - 40],
            ],
            {
              type: 'MultiPoint',
              coordinates: [
                [bounds.west, bounds.south],
                [bounds.east, bounds.north],
              ],
            },
          )
        : geoMercator().fitExtent(
            [
              [70, 40],
              [WIDTH - 70, HEIGHT - 40],
            ],
            tennessee,
          );
    const path = geoPath(projection);
    const onScreen = (point: [number, number] | null): point is [number, number] =>
      !!point && point[0] >= 0 && point[0] <= WIDTH && point[1] >= 0 && point[1] <= HEIGHT;

    const centre = projection.invert!([WIDTH / 2, HEIGHT / 2])!;
    const mileNorth = projection([centre[0], centre[1] + 1 / MILES_PER_DEGREE_LAT])!;
    const pxPerMile = Math.abs(HEIGHT / 2 - mileNorth[1]);

    return {
      projection,
      onScreen,
      pxPerMile,
      stateOutlines: states.features.map((f) => ({
        id: String(f.id),
        d: path(f) ?? '',
        isTn: String(f.id) === TENNESSEE_FIPS,
      })),
      countyOutlines: counties.features.map((f) => {
        const [[x0], [x1]] = path.bounds(f);
        const centroid = path.centroid(f) as [number, number];
        return {
          id: String(f.id),
          name: f.properties.name,
          d: path(f) ?? '',
          // Only name a county when it is big enough on screen to hold the label.
          label: activeView === 'area' && x1 - x0 > 110 && onScreen(centroid) ? centroid : null,
        };
      }),
      towns: TOWNS.filter((town) => activeView === 'area' || town.major)
        .map((town) => ({ ...town, point: projection([town.longitude, town.latitude]) }))
        .filter((town): town is typeof town & { point: [number, number] } => onScreen(town.point)),
      rings:
        activeView === 'area' && origin
          ? RING_MILES.map((miles) => {
              const degrees = miles / MILES_PER_DEGREE_LAT;
              const circle = geoCircle().center([origin.longitude, origin.latitude]).radius(degrees)();
              const top = projection([origin.longitude, origin.latitude + degrees]);
              return { miles, d: path(circle) ?? '', label: onScreen(top) ? top : null };
            })
          : [],
      base: origin ? projection([origin.longitude, origin.latitude]) : null,
    };
  }, [activeView, bounds, origin]);

  const dots = useMemo(
    () =>
      spreadDots(
        sites
          .map((site) => {
            const point = map.projection([site.longitude, site.latitude]);
            if (!map.onScreen(point)) return null;
            // trueX/trueY stay on the address; x/y may be nudged off a neighbour.
            return {
              site,
              x: point[0],
              y: point[1],
              trueX: point[0],
              trueY: point[1],
              radius: Math.min(15, 5 + Math.sqrt(site.jobCount - 1) * 3),
            };
          })
          .filter((dot): dot is NonNullable<typeof dot> => dot !== null),
      )
        // Small dots on top, so a busy address cannot bury a neighbour.
        .sort((a, b) => b.radius - a.radius),
    [sites, map],
  );

  const surface = useMemo(() => {
    if (heat === 'off') return null;
    const points = dots.flatMap((dot) =>
      dot.site.jobs
        .map(jobPrice)
        .filter((price): price is number => price !== null)
        .map((value) => ({ x: dot.trueX, y: dot.trueY, value })),
    );
    const bandwidth = Math.min(46, Math.max(15, map.pxPerMile * 1.6));
    return priceSurface(points, WIDTH, HEIGHT, 8, bandwidth, heat);
  }, [dots, heat, map.pxPerMile]);

  const offScreen = sites.length - dots.length;
  const outsideArea = bounds ? sites.filter((site) => !inBounds(site, bounds)).length : 0;
  const viewLabel = activeView === 'area' ? 'your service area' : 'Tennessee';

  return (
    <section
      aria-label="Job map"
      className="relative mb-6 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#050b17] text-slate-100 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]"
    >
      <style>{`
        @keyframes jm-scan { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }
        @keyframes jm-blink { 50% { opacity: .25 } }
        .jm-scan { animation: jm-scan 7s linear infinite }
        .jm-blink { animation: jm-blink 1.4s ease-in-out infinite }
        .jm-dot { cursor: pointer; outline: none }
        .jm-dot:focus-visible .jm-focus { stroke: #ffffff; stroke-opacity: 1 }
        @media (prefers-reduced-motion: reduce) { .jm-scan, .jm-blink { animation: none } }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-400/10 px-5 py-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300">
            <span className="jm-blink inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" aria-hidden="true" />
            Job locations
            {updatedAt && (
              <span className="normal-case tracking-normal text-slate-500">
                &middot; synced {timeAgo(new Date(updatedAt).toISOString(), now)}
              </span>
            )}
            {status && <span className="normal-case tracking-normal text-amber-300">&middot; {status}</span>}
          </p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-5xl font-bold tabular-nums text-white drop-shadow-[0_0_14px_rgba(34,211,238,0.7)]">
              {summary.jobs.toLocaleString('en-US')}
            </span>
            <span className="text-sm text-slate-400">
              job{summary.jobs === 1 ? '' : 's'} at {summary.addresses} address{summary.addresses === 1 ? '' : 'es'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Toggle
            label="Heat"
            value={heat}
            onChange={setHeat}
            options={[
              { value: 'avg', label: 'Avg price' },
              { value: 'total', label: 'Revenue' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <Toggle
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'area', label: 'Service area' },
              { value: 'tn', label: 'Tennessee' },
            ]}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="relative flex items-center">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="group"
            aria-label={`Map of ${viewLabel} showing where completed jobs were done`}
            className="block h-auto w-full"
          >
            <defs>
              <pattern id="jm-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="1" />
              </pattern>
              <radialGradient id="jm-vignette" cx="50%" cy="50%" r="70%">
                <stop offset="60%" stopColor="rgba(5,11,23,0)" />
                <stop offset="100%" stopColor="rgba(5,11,23,0.85)" />
              </radialGradient>
              <filter id="jm-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="jm-heat-blur" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>

            <rect width={WIDTH} height={HEIGHT} fill="url(#jm-grid)" />

            <g>
              {map.stateOutlines.map((state) => (
                <path
                  key={state.id}
                  d={state.d}
                  fill={state.isTn ? 'rgba(34,211,238,0.08)' : 'rgba(30,58,95,0.28)'}
                  stroke={state.isTn ? 'rgba(103,232,249,0.9)' : 'rgba(56,189,248,0.28)'}
                  strokeWidth={state.isTn ? 1.6 : 0.7}
                  strokeLinejoin="round"
                  filter={state.isTn ? 'url(#jm-glow)' : undefined}
                />
              ))}
            </g>

            <g fill="none" stroke="rgba(103,232,249,0.22)" strokeWidth={activeView === 'area' ? 0.9 : 0.4} strokeLinejoin="round">
              {map.countyOutlines.map((county) => (
                <path key={county.id} d={county.d} />
              ))}
            </g>

            {surface && surface.cells.length > 0 && (
              <g filter="url(#jm-heat-blur)" aria-hidden="true">
                {surface.cells.map((cell) => (
                  <rect
                    key={`${cell.x},${cell.y}`}
                    x={cell.x}
                    y={cell.y}
                    width={surface.cellSize}
                    height={surface.cellSize}
                    fill={heatColor(cell.t)}
                    opacity={cell.strength * 0.62}
                  />
                ))}
              </g>
            )}

            <g aria-hidden="true">
              {map.countyOutlines.map(
                (county) =>
                  county.label && (
                    <text
                      key={county.id}
                      x={county.label[0]}
                      y={county.label[1]}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="11"
                      letterSpacing="3"
                      fill="rgba(148,163,184,0.42)"
                    >
                      {county.name.toUpperCase()} CO.
                    </text>
                  ),
              )}
            </g>

            <g aria-hidden="true">
              {map.rings.map((ring) => (
                <g key={ring.miles}>
                  <path d={ring.d} fill="none" stroke="rgba(148,163,184,0.38)" strokeWidth="1" strokeDasharray="3 6" />
                  {ring.label && (
                    <text
                      x={ring.label[0]}
                      y={ring.label[1] - 4}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="10"
                      fill="rgba(148,163,184,0.75)"
                    >
                      {ring.miles} mi
                    </text>
                  )}
                </g>
              ))}
            </g>

            <g aria-hidden="true">
              {map.towns.map((town) => (
                <g key={town.name}>
                  <rect x={town.point[0] - 1.5} y={town.point[1] - 1.5} width="3" height="3" fill="rgba(226,232,240,0.7)" />
                  <text
                    x={town.point[0] + 6}
                    y={town.point[1] + 3.5}
                    fontSize={activeView === 'area' ? 12 : 10}
                    fill="rgba(226,232,240,0.78)"
                    stroke="#050b17"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {town.name}
                  </text>
                </g>
              ))}
            </g>

            {map.base && map.onScreen(map.base) && (
              <g transform={`translate(${map.base[0]},${map.base[1]})`}>
                <title>Home base: where your drive times are measured from</title>
                <rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" fill="#050b17" stroke="#f8fafc" strokeWidth="1.6" />
                <rect x="-1.5" y="-1.5" width="3" height="3" transform="rotate(45)" fill="#f8fafc" />
              </g>
            )}

            <g>
              {dots.map(({ site, x, y, radius }) => {
                const repeat = site.jobCount > 1;
                const isSelected = site.key === selectedKey;
                const dimmed = selectedKey !== null && !isSelected;
                const summaryLine =
                  `${streetLine(site.address)}, ${site.city}: ${site.jobCount} job${repeat ? 's' : ''}` +
                  (site.pricedCount ? `, ${money(site.revenue)} total` : '');
                return (
                  <g
                    key={site.key}
                    className="jm-dot"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={summaryLine}
                    opacity={dimmed ? 0.55 : 1}
                    onClick={() => setSelectedKey(isSelected ? null : site.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedKey(isSelected ? null : site.key);
                      }
                    }}
                  >
                    <title>{summaryLine}</title>
                    <circle cx={x} cy={y} r={Math.max(14, radius + 7)} fill="transparent" />
                    <circle
                      className="jm-focus"
                      cx={x}
                      cy={y}
                      r={radius + 8}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeOpacity={isSelected ? 1 : 0}
                    />
                    {repeat && <circle cx={x} cy={y} r={radius + 3.5} fill="none" stroke="#fbbf24" strokeWidth="2" />}
                    <circle cx={x} cy={y} r={radius} fill="#050b17" />
                    <circle cx={x} cy={y} r={radius} fill="#22d3ee" opacity="0.92" filter="url(#jm-glow)" />
                    {repeat ? (
                      <text
                        x={x}
                        y={y + 3.6}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize="10.5"
                        fontWeight="700"
                        fill="#04121f"
                        pointerEvents="none"
                      >
                        {site.jobCount}
                      </text>
                    ) : (
                      <circle cx={x} cy={y} r="1.8" fill="#ffffff" pointerEvents="none" />
                    )}
                  </g>
                );
              })}
            </g>

            <rect width={WIDTH} height={HEIGHT} fill="url(#jm-vignette)" pointerEvents="none" />
          </svg>

          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="jm-scan h-1/3 w-full bg-linear-to-b from-transparent via-cyan-400/[0.05] to-transparent" />
          </div>

          {sites.length === 0 && (
            <p className="absolute inset-x-0 bottom-4 px-4 text-center font-mono text-xs text-slate-500">
              No located jobs yet. Completed jobs with an address appear here.
            </p>
          )}
        </div>

        <aside className="flex flex-col border-t border-cyan-400/10 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-px bg-cyan-400/10 text-center font-mono">
            {[
              { label: 'Addresses', value: summary.addresses },
              { label: 'Repeat', value: summary.repeatAddresses },
              { label: 'Not mapped', value: notMapped },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#050b17] px-2 py-3">
                <p className="text-xl font-bold tabular-nums text-cyan-200">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {selected ? (
            <div className="border-t border-cyan-400/10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Selected address</p>
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="font-mono text-[11px] text-cyan-300 hover:text-cyan-100"
                >
                  All addresses
                </button>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-100">{selected.address}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                {selected.jobCount} job{selected.jobCount === 1 ? '' : 's'}
                {selected.pricedCount > 0 && <> &middot; {money(selected.revenue)} total</>}
                {selected.pricedCount > 1 && selected.avgPrice !== null && <> &middot; {money(selected.avgPrice)} avg</>}
              </p>
              {formatDrive(selected) && <p className="font-mono text-[11px] text-slate-500">{formatDrive(selected)}</p>}

              <ul className="mt-3 max-h-56 space-y-px overflow-y-auto border-t border-cyan-400/10 pt-1">
                {selected.jobs.map((job) => {
                  const price = jobPrice(job);
                  return (
                    <li key={job.id}>
                      <Link
                        to={`/admin/jobs?job=${job.id}`}
                        className="flex items-center justify-between gap-3 rounded px-1 py-1.5 hover:bg-cyan-400/10"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-100">{job.job_type || 'Job'}</span>
                          <span className="block font-mono text-[11px] text-slate-500">{formatJobDate(job.date_completed)}</span>
                        </span>
                        <span className="flex-none font-mono text-xs tabular-nums text-cyan-200">
                          {price !== null ? money(price) : job.is_free ? 'Free' : 'No price'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <>
              <p className="border-t border-cyan-400/10 px-4 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
                Addresses by revenue
              </p>
              {sites.length === 0 ? (
                <p className="px-4 pb-5 text-sm text-slate-500">Nothing to list yet.</p>
              ) : (
                <ul className="max-h-[300px] overflow-y-auto pb-2">
                  {sites.map((site) => (
                    <li key={site.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(site.key)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-cyan-400/10"
                      >
                        <span
                          className={`h-2.5 w-2.5 flex-none rounded-full bg-cyan-300 ${
                            site.jobCount > 1 ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#050b17]' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-100">{streetLine(site.address)}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-500">
                            {site.city} &middot; {site.jobCount} job{site.jobCount === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="flex-none font-mono text-xs tabular-nums text-cyan-200">
                          {site.pricedCount ? money(site.revenue) : 'No price'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-cyan-400/10 px-5 py-3 font-mono text-[11px] text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" aria-hidden="true" />
          One job
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 ring-2 ring-amber-400 ring-offset-1 ring-offset-[#050b17]" aria-hidden="true" />
          Repeat address (number is jobs done there)
        </span>
        {origin && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rotate-45 border border-slate-100" aria-hidden="true" />
            Home base{activeView === 'area' ? ', rings every 10 miles' : ''}
          </span>
        )}
        {surface && surface.cells.length > 0 && (
          <span className="flex items-center gap-2">
            {heat === 'avg' ? money(surface.min) : 'Less'}
            <span className="h-2 w-28 rounded-full" style={{ background: HEAT_GRADIENT }} aria-hidden="true" />
            {heat === 'avg' ? money(surface.max) : 'More'}
            <span className="text-slate-500">{heat === 'avg' ? 'average job price nearby' : 'revenue from the area'}</span>
          </span>
        )}
      </div>

      <p className="border-t border-cyan-400/10 px-5 py-2 font-mono text-[10px] text-slate-600">
        Completed jobs only, placed by street address. Free jobs are drawn but left out of prices.
        {activeView === 'area' && outsideArea > 0
          ? ` ${outsideArea} address${outsideArea === 1 ? ' is' : 'es are'} too far out for this view. Switch to Tennessee to see more.`
          : ''}
        {activeView === 'tn' && offScreen > 0 ? ` ${offScreen} located outside Tennessee, not drawn here.` : ''}
      </p>
    </section>
  );
}
