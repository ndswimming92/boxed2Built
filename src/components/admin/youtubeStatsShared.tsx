import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { YoutubeBreakdownRow, YoutubeDemographicRow } from '../../services/apiPlatformService';

export const TRAFFIC_LABELS: Record<string, string> = {
  SHORTS: 'Shorts feed',
  YT_SEARCH: 'YouTube search',
  YT_OTHER_PAGE: 'Other YouTube features',
  NO_LINK_OTHER: 'Direct / unknown',
  EXT_URL: 'External',
  BROWSE: 'Browse features',
  YT_CHANNEL: 'YouTube channels',
  RELATED_VIDEO: 'Suggested videos',
  PLAYLIST: 'Playlists',
  NOTIFICATION: 'Notifications',
  END_SCREEN: 'End screens',
  ADVERTISING: 'Advertising',
  SUBSCRIBER: 'Subscribers feed',
  CAMPAIGN_CARD: 'Cards',
  HASHTAGS: 'Hashtags',
  LIVE_REDIRECT: 'Live redirects',
  SOUND_PAGE: 'Sound page',
  PRODUCT_PAGE: 'Product page',
  VIDEO_REMIXES: 'Remixes',
  NO_LINK_EMBEDDED: 'Embedded players',
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  SHORTS: 'Shorts',
  VIDEO_ON_DEMAND: 'Videos',
  LIVE_STREAM: 'Live streams',
  STORY: 'Stories',
};

export const DEVICE_LABELS: Record<string, string> = {
  MOBILE: 'Mobile',
  DESKTOP: 'Computer',
  TABLET: 'Tablet',
  TV: 'TV',
  GAME_CONSOLE: 'Game console',
  UNKNOWN_PLATFORM: 'Unknown',
};

export const SUBSCRIBED_LABELS: Record<string, string> = {
  SUBSCRIBED: 'Subscribers',
  UNSUBSCRIBED: 'Non-subscribers',
};

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

export function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  return (minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function formatShortDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function changeVs(
  current: number | undefined,
  previous: number | undefined,
): { value: string; positive: boolean } | undefined {
  if (current === undefined || previous === undefined) return undefined;
  if (previous === 0) return current > 0 ? { value: 'New vs previous period', positive: true } : undefined;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return { value: `${sign}${pct.toFixed(0)}% vs previous period`, positive: pct >= 0 };
}

export function ConnectionsLink() {
  return (
    <Link to="/admin/connections" className="underline">
      Admin → Connections
    </Link>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: 'red' | 'amber' | 'slate';
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    red: { box: 'bg-red-50 border-red-200', icon: 'text-red-600', text: 'text-red-800' },
    amber: { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', text: 'text-amber-800' },
    slate: { box: 'bg-slate-50 border-slate-200', icon: 'text-slate-500', text: 'text-slate-700' },
  }[tone];
  return (
    <div className={`p-4 border rounded-lg flex items-start gap-3 ${styles.box}`}>
      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
      <div className={`text-sm ${styles.text}`}>
        <p className="font-medium mb-1">{title}</p>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

export function BreakdownCard({
  title,
  rows,
  labels,
  heading,
}: {
  title: string;
  rows: YoutubeBreakdownRow[] | undefined;
  labels: Record<string, string>;
  heading: string;
}) {
  const list = rows ?? [];
  const totalViews = list.reduce((acc, r) => acc + r.views, 0);
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-3">{title}</h3>
      {list.length === 0 ? (
        <p className="text-sm text-slate-600">No data for this period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 font-medium">{heading}</th>
              <th className="py-2 font-medium text-right">Views</th>
              <th className="py-2 font-medium text-right">Share</th>
              <th className="py-2 font-medium text-right">Watch hrs</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const pct = totalViews > 0 ? (r.views / totalViews) * 100 : 0;
              return (
                <tr key={r.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 text-slate-900">{labels[r.key] ?? r.key}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(r.views)}</td>
                  <td className="py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{r.watch_hours.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const GENDER_SERIES = [
  { key: 'female', label: 'Female', color: '#db2777' },
  { key: 'male', label: 'Male', color: '#2563eb' },
  { key: 'user_specified', label: 'Other', color: '#7c3aed' },
];

/** Age × gender viewer share. YouTube withholds this when the audience is too small. */
export function DemographicsChart({
  rows,
  available,
}: {
  rows: YoutubeDemographicRow[] | undefined;
  available: boolean | undefined;
}) {
  const list = rows ?? [];
  if (!available || list.length === 0) {
    return (
      <Notice tone="slate" title="Not enough data yet">
        YouTube hides age and gender breakdowns until a channel or video has enough viewers to protect their
        privacy. This will fill in as your audience grows.
      </Notice>
    );
  }

  const byAge = new Map<string, Record<string, string | number>>();
  for (const r of list) {
    const row = byAge.get(r.age_group) ?? { age: r.age_group };
    row[r.gender] = r.percentage;
    byAge.set(r.age_group, row);
  }
  const data = [...byAge.values()].sort((a, b) => String(a.age).localeCompare(String(b.age)));
  const present = GENDER_SERIES.filter((g) => list.some((r) => r.gender === g.key));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="age" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend />
          {present.map((g) => (
            <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a" fill={g.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
