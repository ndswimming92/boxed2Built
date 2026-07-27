import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Users,
  Eye,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Plug,
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
import { getSocialMetrics, SocialMetrics } from '../../services/apiPlatformService';
import MetricCard from '../../components/analytics/MetricCard';
import ChartCard from '../../components/analytics/ChartCard';

function formatTrendDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SocialMetricsPage() {
  const [metrics, setMetrics] = useState<SocialMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getSocialMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load social metrics.');
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Social Metrics</h1>
          <p className="text-sm sm:text-base text-slate-600">Facebook and Instagram performance at a glance.</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium mb-1">{error}</p>
            <p>
              Make sure Facebook is connected under{' '}
              <Link to="/admin/connections" className="underline">
                Admin → Connections
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const { facebook, instagram } = metrics;

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Social Metrics</h1>
          <p className="text-sm sm:text-base text-slate-600">Facebook and Instagram performance at a glance.</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Facebook */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <Facebook className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Facebook — {facebook.page_name || 'Page'}</h2>
        </div>

        {!facebook.connected ? (
          <NotConnectedNotice provider="Facebook" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <MetricCard
                title="Page Followers"
                value={facebook.followers ?? '—'}
                icon={Users}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
              />
              <MetricCard
                title="Reach (last 30 days)"
                value={sumMetric(facebook.trend, 'page_impressions_unique')}
                icon={Eye}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
              />
            </div>
            {facebook.insights_error ? (
              <InsightsUnavailableNotice message={facebook.insights_error} />
            ) : facebook.trend.length > 0 ? (
              <ChartCard title="Facebook Page Trend" subtitle="Daily reach and engaged users, last 30 days">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={facebook.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={formatTrendDate} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={formatTrendDate} />
                    <Legend />
                    <Line type="monotone" dataKey="page_impressions_unique" name="Reach" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="page_engaged_users" name="Engaged Users" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            ) : null}
          </>
        )}
      </div>

      {/* Instagram */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Instagram className="w-5 h-5 text-pink-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            Instagram{instagram.username ? ` — @${instagram.username}` : ''}
          </h2>
        </div>

        {!instagram.connected ? (
          <NotConnectedNotice provider="Instagram" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <MetricCard
                title="Followers"
                value={instagram.followers ?? '—'}
                icon={Users}
                iconColor="text-pink-600"
                iconBgColor="bg-pink-100"
              />
              <MetricCard
                title="Posts"
                value={instagram.media_count ?? '—'}
                icon={ImageIcon}
                iconColor="text-pink-600"
                iconBgColor="bg-pink-100"
              />
              <MetricCard
                title="Reach (last 30 days)"
                value={sumMetric(instagram.trend, 'reach')}
                icon={Eye}
                iconColor="text-pink-600"
                iconBgColor="bg-pink-100"
              />
            </div>
            {instagram.insights_error ? (
              <InsightsUnavailableNotice message={instagram.insights_error} />
            ) : instagram.trend && instagram.trend.length > 0 ? (
              <ChartCard title="Instagram Trend" subtitle="Daily reach and profile views, last 30 days">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={instagram.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={formatTrendDate} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={formatTrendDate} />
                    <Legend />
                    <Line type="monotone" dataKey="reach" name="Reach" stroke="#db2777" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profile_views" name="Profile Views" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function sumMetric(trend: { [metric: string]: string | number }[] | undefined, key: string): string {
  if (!trend || trend.length === 0) return '—';
  const total = trend.reduce((acc, row) => acc + (typeof row[key] === 'number' ? (row[key] as number) : 0), 0);
  return total.toLocaleString();
}

function NotConnectedNotice({ provider }: { provider: string }) {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
      <Plug className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-slate-700">
        <p className="font-medium mb-1">{provider} isn't connected</p>
        <p>
          Connect it under{' '}
          <Link to="/admin/connections" className="underline text-emerald-700">
            Admin → Connections
          </Link>{' '}
          to see metrics here.
        </p>
      </div>
    </div>
  );
}

function InsightsUnavailableNotice({ message }: { message: string }) {
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-800">
        <p className="font-medium mb-1">Trend data isn't available right now</p>
        <p>{message}</p>
        <p className="mt-1">
          If you just added insights permissions, reconnect Facebook under{' '}
          <Link to="/admin/connections" className="underline">
            Admin → Connections
          </Link>{' '}
          so the new scopes take effect.
        </p>
      </div>
    </div>
  );
}
