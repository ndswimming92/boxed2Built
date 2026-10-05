import { useEffect, useState } from 'react';
import { X, ExternalLink, Eye, Clock, UserPlus, Timer, ThumbsUp, MessageCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getYoutubeVideoMetrics,
  YoutubeRangeDays,
  YoutubeVideoMetrics,
} from '../../services/apiPlatformService';
import MetricCard from '../analytics/MetricCard';
import ChartCard from '../analytics/ChartCard';
import {
  BreakdownCard,
  DemographicsChart,
  Notice,
  TRAFFIC_LABELS,
  formatDuration,
  formatHours,
  formatNumber,
  formatShortDate,
} from './youtubeStatsShared';

interface Props {
  videoId: string;
  days: YoutubeRangeDays;
  onClose: () => void;
}

export default function YoutubeVideoPanel({ videoId, days, onClose }: Props) {
  const [data, setData] = useState<YoutubeVideoMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    getYoutubeVideoMetrics(videoId, days)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load video stats.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [videoId, days]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totals = data?.totals ?? undefined;
  const netSubs = totals ? totals.subscribersGained - totals.subscribersLost : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Video stats">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative w-full max-w-2xl bg-slate-50 h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Video stats · last {days} days</p>
            <h2 className="text-lg font-semibold text-slate-900 truncate">{data?.video.title ?? 'Loading…'}</h2>
            {data && (
              <a
                href={`https://www.youtube.com/watch?v=${data.video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-700 underline inline-flex items-center gap-1"
              >
                Watch on YouTube <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          )}
          {error && <Notice tone="red" title={error} />}

          {data && (
            <>
              {data.analytics_error && <Notice tone="amber" title="Some data couldn't be loaded">{data.analytics_error}</Notice>}

              <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4">
                {data.video.thumbnail && (
                  <img src={data.video.thumbnail} alt="" className="w-28 h-16 object-cover rounded" />
                )}
                <div className="text-sm text-slate-600">
                  <p>Published {new Date(data.video.published_at).toLocaleDateString()}</p>
                  <p>
                    Lifetime: {formatNumber(data.video.lifetime_views)} views ·{' '}
                    {formatNumber(data.video.lifetime_likes)} likes · {formatNumber(data.video.lifetime_comments)} comments
                  </p>
                </div>
              </div>

              {totals && (
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard title="Views" value={formatNumber(totals.views)} icon={Eye} iconColor="text-red-600" iconBgColor="bg-red-100" />
                  <MetricCard title="Watch time (hrs)" value={formatHours(totals.estimatedMinutesWatched)} icon={Clock} iconColor="text-blue-600" iconBgColor="bg-blue-100" />
                  <MetricCard title="Subscribers gained" value={netSubs === undefined ? '—' : `${netSubs > 0 ? '+' : ''}${formatNumber(netSubs)}`} icon={UserPlus} iconColor="text-emerald-600" iconBgColor="bg-emerald-100" />
                  <MetricCard title="Avg. view duration" value={formatDuration(totals.averageViewDuration)} icon={Timer} iconColor="text-amber-600" iconBgColor="bg-amber-100" />
                  <MetricCard title="Likes" value={formatNumber(totals.likes)} icon={ThumbsUp} iconColor="text-slate-600" iconBgColor="bg-slate-100" />
                  <MetricCard title="Comments" value={formatNumber(totals.comments)} icon={MessageCircle} iconColor="text-slate-600" iconBgColor="bg-slate-100" />
                </div>
              )}

              {data.trend.length > 0 && (
                <ChartCard title="Views over time" subtitle={`Daily, last ${days} days`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip labelFormatter={(label) => formatShortDate(String(label))} />
                      <Line type="monotone" dataKey="views" name="Views" stroke="#dc2626" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {data.retention.length > 0 && (
                <ChartCard
                  title="Audience retention"
                  subtitle="Share of viewers still watching at each point in the video (lifetime)"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.retention}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="position" unit="%" tick={{ fontSize: 12 }} />
                      <YAxis unit="%" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v) => `${Number(v)}%`}
                        labelFormatter={(v) => `${v}% through the video`}
                      />
                      <Area type="monotone" dataKey="watch_ratio" name="Still watching" stroke="#2563eb" fill="#bfdbfe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <BreakdownCard title="Traffic sources" rows={data.traffic_sources} labels={TRAFFIC_LABELS} heading="Source" />
              <BreakdownCard title="Top countries" rows={data.countries} labels={{}} heading="Country" />

              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Audience age & gender</h3>
                <DemographicsChart rows={data.demographics} available={data.demographics_available} />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
