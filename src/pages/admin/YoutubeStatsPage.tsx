import { useCallback, useEffect, useState } from 'react';
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
  Plug,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getYoutubeMetrics,
  YoutubeContentType,
  YoutubeMetrics,
  YoutubeRangeDays,
} from '../../services/apiPlatformService';
import MetricCard from '../../components/analytics/MetricCard';
import ChartCard from '../../components/analytics/ChartCard';
import YoutubeVideoPanel from '../../components/admin/YoutubeVideoPanel';
import {
  BreakdownCard,
  CONTENT_TYPE_LABELS,
  ConnectionsLink,
  DEVICE_LABELS,
  DemographicsChart,
  Notice,
  SUBSCRIBED_LABELS,
  TRAFFIC_LABELS,
  changeVs,
  formatDuration,
  formatHours,
  formatNumber,
  formatShortDate,
} from '../../components/admin/youtubeStatsShared';

const RANGES: { value: YoutubeRangeDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 28, label: '28 days' },
  { value: 90, label: '90 days' },
];

const CONTENT_TABS: { value: YoutubeContentType; label: string }[] = [
  { value: 'all', label: 'All content' },
  { value: 'video', label: 'Videos' },
  { value: 'shorts', label: 'Shorts' },
];

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'audience', label: 'Audience' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'top-videos', label: 'Top videos' },
  { id: 'history', label: 'History' },
];

type TrendMetric = 'views' | 'watch_hours' | 'subscribers_net';

const TREND_TABS: { key: TrendMetric; label: string; color: string }[] = [
  { key: 'views', label: 'Views', color: '#dc2626' },
  { key: 'watch_hours', label: 'Watch time (hrs)', color: '#2563eb' },
  { key: 'subscribers_net', label: 'Net subscribers', color: '#10b981' },
];

export default function YoutubeStatsPage() {
  const [days, setDays] = useState<YoutubeRangeDays>(28);
  const [contentType, setContentType] = useState<YoutubeContentType>('all');
  const [data, setData] = useState<YoutubeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('views');
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  // The admin layout has its own sticky top bar; pin our controls just below it.
  const [stickyTop, setStickyTop] = useState(0);

  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector('header');
      setStickyTop(bar ? bar.getBoundingClientRect().height : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fetchData = useCallback(async (range: YoutubeRangeDays, type: YoutubeContentType, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setData(await getYoutubeMetrics(range, type));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YouTube stats.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days, contentType);
  }, [days, contentType, fetchData]);

  const scopeLabel = CONTENT_TABS.find((t) => t.value === contentType)!.label.toLowerCase();

  const titleBlock = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">YouTube Stats</h1>
      <p className="text-sm sm:text-base text-slate-600">
        {data?.channel?.title ? `${data.channel.title} — ` : ''}channel performance at a glance.
      </p>
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Content type" options={CONTENT_TABS} value={contentType} onChange={setContentType} />
      <Segmented label="Date range" options={RANGES} value={days} onChange={setDays} />
      <button
        onClick={() => fetchData(days, contentType, true)}
        disabled={refreshing || loading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );

  // Used by the loading-free fallback states (error / not connected / reconnect).
  const header = (
    <div className="mb-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      {titleBlock}
      {controls}
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
  const history = (data.history ?? []).map((h) => ({ ...h, date: h.snapshot_date }));

  return (
    <div className="max-w-7xl">
      <div className="mb-4">{titleBlock}</div>

      {/* Pinned bar: jump-to sections + filters stay visible while scrolling */}
      <div
        style={{ top: stickyTop }}
        className="sticky z-20 -mx-4 lg:-mx-8 px-4 lg:px-8 py-2 mb-6 bg-slate-50/95 backdrop-blur border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2"
      >
        <nav aria-label="Sections" className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 rounded-full hover:bg-white hover:text-emerald-700 whitespace-nowrap"
            >
              {s.label}
            </a>
          ))}
        </nav>
        {controls}
      </div>

      <div className="space-y-10">
        {data.analytics_error && (
          <Notice tone="amber" title="Some analytics couldn't be loaded">
            {data.analytics_error}. If this mentions permissions or access, reconnect YouTube under{' '}
            <ConnectionsLink />.
          </Notice>
        )}

        <Section id="overview" title="Overview" subtitle="All-time totals for your whole channel">
          {data.channel ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard title="Subscribers" value={formatNumber(data.channel.subscribers)} icon={Users} iconColor="text-red-600" iconBgColor="bg-red-100" />
              <MetricCard title="Total views" value={formatNumber(data.channel.total_views)} icon={Eye} iconColor="text-red-600" iconBgColor="bg-red-100" />
              <MetricCard title="Videos" value={formatNumber(data.channel.video_count)} icon={Video} iconColor="text-red-600" iconBgColor="bg-red-100" />
            </div>
          ) : (
            <Notice tone="amber" title="Channel details unavailable">
              {data.channel_error ?? 'Could not load channel details.'}
            </Notice>
          )}
        </Section>

        <Section
          id="performance"
          title="Performance"
          subtitle={`${periodLabel} · ${scopeLabel} (${data.period?.start} to ${data.period?.end})`}
        >
          {totals ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Views" value={formatNumber(totals.views)} icon={Eye} iconColor="text-red-600" iconBgColor="bg-red-100" trend={changeVs(totals.views, prev?.views)} />
              <MetricCard title="Watch time (hrs)" value={formatHours(totals.estimatedMinutesWatched)} icon={Clock} iconColor="text-blue-600" iconBgColor="bg-blue-100" trend={changeVs(totals.estimatedMinutesWatched, prev?.estimatedMinutesWatched)} />
              <MetricCard
                title="Net subscribers"
                value={netSubs === undefined ? '—' : `${netSubs > 0 ? '+' : ''}${formatNumber(netSubs)}`}
                subtitle={`+${formatNumber(totals.subscribersGained)} / −${formatNumber(totals.subscribersLost)}`}
                icon={UserPlus}
                iconColor="text-emerald-600"
                iconBgColor="bg-emerald-100"
                trend={changeVs(netSubs, prevNetSubs)}
              />
              <MetricCard title="Avg. view duration" value={formatDuration(totals.averageViewDuration)} icon={Timer} iconColor="text-amber-600" iconBgColor="bg-amber-100" />
              <MetricCard title="Likes" value={formatNumber(totals.likes)} icon={ThumbsUp} iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.likes, prev?.likes)} />
              <MetricCard title="Comments" value={formatNumber(totals.comments)} icon={MessageCircle} iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.comments, prev?.comments)} />
              <MetricCard title="Shares" value={formatNumber(totals.shares)} icon={Share2} iconColor="text-slate-600" iconBgColor="bg-slate-100" trend={changeVs(totals.shares, prev?.shares)} />
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
                    <Line type="monotone" dataKey={trendMetric} name={activeTab.label} stroke={activeTab.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}
        </Section>

        <Section id="audience" title="Audience" subtitle={`Who is watching · ${periodLabel.toLowerCase()} · ${scopeLabel}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Age & gender</h3>
              <DemographicsChart rows={data.demographics} available={data.demographics_available} />
            </div>
            <div className="space-y-4">
              <BreakdownCard title="Subscribers vs. non-subscribers" rows={data.subscribed_status} labels={SUBSCRIBED_LABELS} heading="Viewer" />
              <BreakdownCard title="Devices" rows={data.devices} labels={DEVICE_LABELS} heading="Device" />
              <BreakdownCard title="Top countries" rows={data.countries} labels={{}} heading="Country" />
            </div>
          </div>
        </Section>

        <Section id="discovery" title="Discovery" subtitle="How viewers find you">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BreakdownCard title={`Traffic sources (${scopeLabel})`} rows={data.traffic_sources} labels={TRAFFIC_LABELS} heading="Source" />
            <BreakdownCard title="Shorts vs. videos (all content)" rows={data.content_types} labels={CONTENT_TYPE_LABELS} heading="Type" />
          </div>
        </Section>

        <Section
          id="top-videos"
          title="Top videos"
          subtitle={`Best performers, ${periodLabel.toLowerCase()} · ${scopeLabel} — select one for a detailed breakdown`}
        >
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
                    <th className="px-2 py-3" aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_videos.map((v) => (
                    <tr
                      key={v.video_id}
                      onClick={() => setOpenVideoId(v.video_id)}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenVideoId(v.video_id); }}
                          className="flex items-center gap-3 text-left"
                        >
                          {v.thumbnail && (
                            <img src={v.thumbnail} alt="" className="w-16 h-9 object-cover rounded flex-shrink-0" loading="lazy" />
                          )}
                          <span className="font-medium text-slate-900 line-clamp-2">{v.title}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.views)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{v.watch_hours.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.likes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(v.comments)}</td>
                      <td className="px-2 py-3 text-slate-400"><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No video data for this period.</p>
          )}
        </Section>

        <Section
          id="history"
          title="History"
          subtitle="Daily snapshots of your channel totals, saved automatically so growth is visible over time"
        >
          {history.length >= 2 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Subscribers" subtitle={`Since ${formatShortDate(history[0].date)}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={['dataMin', 'dataMax']} />
                    <Tooltip labelFormatter={formatShortDate} />
                    <Line type="monotone" dataKey="subscribers_total" name="Subscribers" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Total views & videos" subtitle="Running channel totals">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="views" tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} />
                    <YAxis yAxisId="videos" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} domain={['dataMin', 'dataMax']} />
                    <Tooltip labelFormatter={formatShortDate} />
                    <Legend />
                    <Line yAxisId="views" type="monotone" dataKey="total_views" name="Total views" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line yAxisId="videos" type="monotone" dataKey="video_count" name="Videos" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : (
            <Notice tone="slate" title="History is just getting started">
              A snapshot is saved every morning. Once there are two or more days, growth charts appear here
              ({history.length} saved so far).
            </Notice>
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

      {openVideoId && (
        <YoutubeVideoPanel videoId={openVideoId} days={days} onClose={() => setOpenVideoId(null)} />
      )}
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-40 xl:scroll-mt-36">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === o.value ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
