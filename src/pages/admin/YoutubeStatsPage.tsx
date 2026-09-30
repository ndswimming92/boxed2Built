import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Youtube,
  Eye,
  Clock,
  UserPlus,
  ThumbsUp,
  MessageCircle,
  Share2,
  Timer,
  Users,
  Video,
  RefreshCw,
  AlertCircle,
  Plug,
  ExternalLink,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getYoutubeMetrics,
  YoutubeMetrics,
  YoutubeRangeDays,
  YoutubeBreakdownRow,
} from '../../services/apiPlatformService';
import MetricCard from '../../components/analytics/MetricCard';
import ChartCard from '../../components/analytics/ChartCard';

const RANGES: { value: YoutubeRangeDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 28, label: '28 days' },
  { value: 90, label: '90 days' },
];

type TrendMetric = 'views' | 'watch_hours' | 'subscribers_net';

const TREND_TABS: { key: TrendMetric; label: string; color: string }[] = [
  { key: 'views', label: 'Views', color: '#dc2626' },
  { key: 'watch_hours', label: 'Watch time (hrs)', color: '#2563eb' },
  { key: 'subscribers_net', label: 'Net subscribers', color: '#10b981' },
];

const TRAFFIC_LABELS: Record<string, string> = {
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

const CONTENT_TYPE_LABELS: Record<string, string> = {
  SHORTS: 'Shorts',
  VIDEO_ON_DEMAND: 'Videos',
  LIVE_STREAM: 'Live streams',
  STORY: 'Stories',
};

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  return (minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function formatShortDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function changeVs(
  current: number | undefined,
  previous: number | undefined,
): { value: string; positive: boolean } | undefined {
  if (current === undefined || previous === undefined) return undefined;
  if (previous === 0) return current > 0 ? { value: 'New vs previous period', positive: true } : undefined;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return { value: `${sign}${pct.toFixed(0)}% vs previous period`, positive: pct >= 0 };
}

export default function YoutubeStatsPage() {
  const [days, setDays] = useState<YoutubeRangeDays>(28);
  const [data, setData] = useState<YoutubeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('views');

  const fetchData = useCallback(async (range: YoutubeRangeDays, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setData(await getYoutubeMetrics(range));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YouTube stats.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const header = (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">YouTube Stats</h1>
        <p className="text-sm sm:text-base text-slate-600">
          {data?.channel?.title ? `${data.channel.title} — ` : ''}channel performance at a glance.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                days === r.value ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchData(days, true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl">
        {header}
        <Notice tone="red" title={error}>
          Make sure YouTube is connected under <ConnectionsLink />.
        </Notice>
      </div>
    );
  }

  if (!data) return null;

  if (!data.connected) {
    return (
      <div className="max-w-7xl">
        {header}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
          <Plug className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-medium mb-1">YouTube isn't connected</p>
            <p>Connect it under <ConnectionsLink /> to see your channel stats here.</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.needs_reconnect) {
    return (
      <div className="max-w-7xl">
        {header}
        <Notice tone="amber" title="YouTube needs to be reconnected">
          {data.error ? `${data.error} ` : ''}Reconnect under <ConnectionsLink /> and approve the
          YouTube analytics permissions.
        </Notice>
      </div>
    );
  }

  const totals = data.totals ?? undefined;
  const prev = data.previous_totals ?? undefined;
  const netSubs = totals ? totals.subscribersGained - totals.subscribersLost : undefined;
  const prevNetSubs = prev ? prev.subscribersGained - prev.subscribersLost : undefined;
  const activeTab = TREND_TABS.find((t) => t.key === trendMetric)!;
  const periodLabel = `Last ${data.days ?? days} days`;

  return (
    <div className="max-w-7xl space-y-8">
      {header}

      {data.analytics_error && (
        <Notice tone="amber" title="Some analytics couldn't be loaded">
          {data.analytics_error}. If you haven't yet, reconnect YouTube under <ConnectionsLink /> so the
          analytics permissions take effect.
        </Notice>
      )}

      {/* Channel overview */}
      <Section title="Channel overview" subtitle="All-time totals for your channel">
        {data.channel ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Subscribers"
              value={formatNumber(data.channel.subscribers)}
              icon={Users}
              iconColor="text-red-600"
              iconBgColor="bg-red-100"
            />
            <MetricCard
              title="Total views"
              value={formatNumber(data.channel.total_views)}
              icon={Eye}
              iconColor="text-red-600"
              iconBgColor="bg-red-100"
            />
            <MetricCard
              title="Videos"
              value={formatNumber(data.channel.video_count)}
              icon={Video}
              iconColor="text-red-600"
              iconBgColor="bg-red-100"
            />
          </div>
        ) : (
          <Notice tone="amber" title="Channel details unavailable">
            {data.channel_error ?? 'Could not load channel details.'}
          </Notice>
        )}
      </Section>

      {/* Performance */}
      <Section title="Performance" subtitle={`${periodLabel} (${data.period?.start} to ${data.period?.end})`}>
        {totals ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Views"
              value={formatNumber(totals.views)}
              icon={Eye}
              iconColor="text-red-600"
              iconBgColor="bg-red-100"
              trend={changeVs(totals.views, prev?.views)}
            />
            <MetricCard
              title="Watch time (hrs)"
              value={formatHours(totals.estimatedMinutesWatched)}
              icon={Clock}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100"
              trend={changeVs(totals.estimatedMinutesWatched, prev?.estimatedMinutesWatched)}
            />
            <MetricCard
              title="Net subscribers"
              value={netSubs === undefined ? '—' : `${netSubs > 0 ? '+' : ''}${formatNumber(netSubs)}`}
              subtitle={`+${formatNumber(totals.subscribersGained)} / −${formatNumber(totals.subscribersLost)}`}
              icon={UserPlus}
              iconColor="text-emerald-600"
              iconBgColor="bg-emerald-100"
              trend={changeVs(netSubs, prevNetSubs)}
            />
            <MetricCard
              title="Avg. view duration"
              value={formatDuration(totals.averageViewDuration)}
              icon={Timer}
              iconColor="text-amber-600"
              iconBgColor="bg-amber-100"
            />
            <MetricCard title="Likes" value={formatNumber(totals.likes)} icon={ThumbsUp}
              iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.likes, prev?.likes)} />
            <MetricCard title="Comments" value={formatNumber(totals.comments)} icon={MessageCircle}
              iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.comments, prev?.comments)} />
            <MetricCard title="Shares" value={formatNumber(totals.shares)} icon={Share2}
              iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.shares, prev?.shares)} />
          </div>
        ) : (
          <Notice tone="amber" title="Performance totals unavailable">
            Totals couldn't be loaded for this period.
          </Notice>
        )}

        {data.trend && data.trend.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {TREND_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTrendMetric(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                    trendMetric === t.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <ChartCard title={`${activeTab.label} over time`} subtitle={`Daily, ${periodLabel.toLowerCase()}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={trendMetric === 'watch_hours'} />
                  <Tooltip labelFormatter={formatShortDate} />
                  <Line
                    type="monotone"
                    dataKey={trendMetric}
                    name={activeTab.label}
                    stroke={activeTab.color}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </Section>

      {/* Audience & discovery */}
      <Section title="Audience & discovery" subtitle="How viewers find you and what they watch">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownCard
            title="Traffic sources"
            rows={data.traffic_sources}
            labels={TRAFFIC_LABELS}
            heading="Source"
          />
          <div className="space-y-4">
            <BreakdownCard
              title="Shorts vs. videos"
              rows={data.content_types}
              labels={CONTENT_TYPE_LABELS}
              heading="Type"
            />
            <BreakdownCard title="Top countries" rows={data.countries} labels={{}} heading="Country" />
          </div>
        </div>
      </Section>

      {/* Top content */}
      <Section title="Top videos" subtitle={`Best performers, ${periodLabel.toLowerCase()}`}>
        {data.top_videos && data.top_videos.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Video</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                  <th className="px-4 py-3 font-medium text-right">Watch hrs</th>
                  <th className="px-4 py-3 font-medium text-right">Likes</th>
                  <th className="px-4 py-3 font-medium text-right">Comments</th>
                </tr>
              </thead>
              <tbody>
                {data.top_videos.map((v) => (
                  <tr key={v.video_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <a
                        href={`https://www.youtube.com/watch?v=${v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 group"
                      >
                        {v.thumbnail && (
                          <img src={v.thumbnail} alt="" className="w-16 h-9 object-cover rounded flex-shrink-0" loading="lazy" />
                        )}
                        <span className="font-medium text-slate-900 group-hover:underline line-clamp-2">{v.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.views)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.watch_hours.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.likes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No video data for this period.</p>
        )}
      </Section>

      <p className="text-xs text-slate-500">
        YouTube analytics can lag by about two days. Last fetched {new Date(data.fetched_at).toLocaleString()}.{' '}
        <a
          href="https://studio.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-1"
        >
          <Youtube className="w-3 h-3" /> Open YouTube Studio
        </a>{' '}
        for realtime numbers.
      </p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ConnectionsLink() {
  return (
    <Link to="/admin/connections" className="underline">
      Admin → Connections
    </Link>
  );
}

function Notice({ tone, title, children }: { tone: 'red' | 'amber'; title: string; children: React.ReactNode }) {
  const styles =
    tone === 'red'
      ? { box: 'bg-red-50 border-red-200', icon: 'text-red-600', text: 'text-red-800' }
      : { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', text: 'text-amber-800' };
  return (
    <div className={`p-4 border rounded-lg flex items-start gap-3 ${styles.box}`}>
      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
      <div className={`text-sm ${styles.text}`}>
        <p className="font-medium mb-1">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}

function BreakdownCard({
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

