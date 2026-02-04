import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, UserX, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import MetricCard from './MetricCard';
import ChartCard from './ChartCard';
import LoadingSpinner from '../ui/LoadingSpinner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

interface ClientMetrics {
  total_clients: number;
  repeat_customers: number;
  high_value_clients: number;
  dormant_clients: number;
  new_this_month: number;
  total_revenue: number;
  average_clv: number;
  retention_rate: number;
}

interface ClientAcquisition {
  month: string;
  new_clients: number;
  total_clients: number;
}

interface ClientSource {
  source: string;
  count: number;
  revenue: number;
}

export default function ClientAnalytics() {
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [acquisition, setAcquisition] = useState<ClientAcquisition[]>([]);
  const [sources, setSources] = useState<ClientSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);

      // Get all clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) throw clientsError;

      if (!clients) {
        setLoading(false);
        return;
      }

      // Calculate metrics
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

      const newThisMonth = clients.filter(c =>
        new Date(c.created_at) >= firstOfMonth
      ).length;

      const totalRevenue = clients.reduce((sum, c) =>
        sum + (parseFloat(c.total_revenue?.toString() || '0')), 0
      );

      // Calculate retention rate (clients with activity in last 6 months / total clients)
      const activeClients = clients.filter(c =>
        c.last_contact_date && new Date(c.last_contact_date) >= sixMonthsAgo
      ).length;

      const retentionRate = clients.length > 0
        ? (activeClients / clients.length) * 100
        : 0;

      setMetrics({
        total_clients: clients.length,
        repeat_customers: clients.filter(c => c.job_count >= 2).length,
        high_value_clients: clients.filter(c =>
          ['high_value', 'vip'].includes(c.client_value_tier)
        ).length,
        dormant_clients: clients.filter(c => c.client_status === 'dormant').length,
        new_this_month: newThisMonth,
        total_revenue: totalRevenue,
        average_clv: clients.length > 0 ? totalRevenue / clients.length : 0,
        retention_rate: retentionRate,
      });

      // Calculate acquisition trend (last 6 months)
      const acquisitionData: ClientAcquisition[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const newInMonth = clients.filter(c => {
          const created = new Date(c.created_at);
          return created >= date && created <= monthEnd;
        }).length;

        const totalUpToMonth = clients.filter(c =>
          new Date(c.created_at) <= monthEnd
        ).length;

        acquisitionData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          new_clients: newInMonth,
          total_clients: totalUpToMonth,
        });
      }
      setAcquisition(acquisitionData);

      // Calculate source breakdown
      const sourceMap = new Map<string, { count: number; revenue: number }>();
      clients.forEach(c => {
        const source = c.source || 'Unknown';
        const existing = sourceMap.get(source) || { count: 0, revenue: 0 };
        sourceMap.set(source, {
          count: existing.count + 1,
          revenue: existing.revenue + parseFloat(c.total_revenue?.toString() || '0'),
        });
      });

      const sourceData = Array.from(sourceMap.entries())
        .map(([source, data]) => ({ source, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setSources(sourceData);

    } catch (error) {
      console.error('Error loading client analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const statusDistribution = [
    { name: 'Active', value: metrics.total_clients - metrics.dormant_clients - metrics.repeat_customers },
    { name: 'Repeat', value: metrics.repeat_customers },
    { name: 'Dormant', value: metrics.dormant_clients },
    { name: 'Leads', value: Math.max(0, metrics.total_clients - metrics.repeat_customers - metrics.dormant_clients) },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Client Analytics</h2>
        <div className="text-sm text-gray-600">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Clients"
          value={metrics.total_clients}
          icon={Users}
          color="blue"
          subtitle={`${metrics.new_this_month} new this month`}
          trend={metrics.new_this_month > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          title="Repeat Customers"
          value={metrics.repeat_customers}
          icon={TrendingUp}
          color="green"
          subtitle={`${metrics.total_clients > 0 ? Math.round((metrics.repeat_customers / metrics.total_clients) * 100) : 0}% of total`}
        />
        <MetricCard
          title="Avg Customer Value"
          value={formatCurrency(metrics.average_clv)}
          icon={DollarSign}
          color="purple"
          subtitle="Lifetime value per client"
        />
        <MetricCard
          title="Retention Rate"
          value={`${Math.round(metrics.retention_rate)}%`}
          icon={TrendingUp}
          color={metrics.retention_rate >= 70 ? 'green' : 'orange'}
          subtitle="Active in last 6 months"
          trend={metrics.retention_rate >= 70 ? 'up' : 'down'}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acquisition Trend */}
        <ChartCard title="Client Acquisition Trend" subtitle="New clients per month">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={acquisition}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="new_clients"
                stroke="#3b82f6"
                name="New Clients"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="total_clients"
                stroke="#10b981"
                name="Total Clients"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Client Status Distribution */}
        <ChartCard title="Client Status Distribution" subtitle="Breakdown by engagement level">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Client Source Performance */}
      <ChartCard title="Top Client Sources" subtitle="Revenue by acquisition source">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sources}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="source" />
            <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'Revenue') return formatCurrency(value);
                return value;
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Clients" />
            <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Client Health Summary */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Health Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="font-medium text-green-900">High Value Clients</p>
            </div>
            <p className="text-3xl font-bold text-green-900">{metrics.high_value_clients}</p>
            <p className="text-sm text-green-700 mt-1">
              {metrics.total_clients > 0
                ? Math.round((metrics.high_value_clients / metrics.total_clients) * 100)
                : 0}% of client base
            </p>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="w-5 h-5 text-orange-600" />
              <p className="font-medium text-orange-900">Dormant Clients</p>
            </div>
            <p className="text-3xl font-bold text-orange-900">{metrics.dormant_clients}</p>
            <p className="text-sm text-orange-700 mt-1">
              Require re-engagement outreach
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <p className="font-medium text-blue-900">Total CLV</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{formatCurrency(metrics.total_revenue)}</p>
            <p className="text-sm text-blue-700 mt-1">
              Combined lifetime value
            </p>
          </div>
        </div>
      </div>

      {/* Insights & Recommendations */}
      {metrics.dormant_clients > 0 && (
        <div className="p-6 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            Action Required: Dormant Clients
          </h3>
          <p className="text-orange-800 mb-4">
            You have {metrics.dormant_clients} dormant clients who haven't been contacted in 90+ days.
            These represent potential lost revenue and should be targeted for re-engagement campaigns.
          </p>
          <div className="flex gap-3">
            <a
              href="/admin/clients?segment=dormant"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              View Dormant Clients
            </a>
          </div>
        </div>
      )}

      {metrics.retention_rate < 70 && (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            Low Retention Rate Detected
          </h3>
          <p className="text-yellow-800 mb-4">
            Your client retention rate is {Math.round(metrics.retention_rate)}%, which is below the recommended
            70%. Consider implementing regular follow-up campaigns and loyalty programs to improve retention.
          </p>
        </div>
      )}
    </div>
  );
}
