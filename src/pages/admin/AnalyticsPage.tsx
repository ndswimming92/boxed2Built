import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';
import {
  calculateMetrics,
  getJobsByType,
  getLocationRevenue,
  getMonthlyData,
  getReferralSourceData,
  getClientTypeData,
  getHealthStatus,
  TimePeriod,
} from '../../services/analyticsService';
import MetricCard from '../../components/analytics/MetricCard';
import ChartCard from '../../components/analytics/ChartCard';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import {
  TrendingUp,
  DollarSign,
  Clock,
  Briefcase,
  Users,
  Target,
  Activity,
  Calendar,
  MapPin,
  UserCheck,
} from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function AnalyticsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('current_year');
  const { jobs, loading, lastUpdated, isConnected } = useRealtimeJobs(businessId);

  useEffect(() => {
    fetchBusinessId();
  }, []);

  const fetchBusinessId = async () => {
    const { data } = await supabase
      .from('business_info')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setBusinessId(data.id);
    }
  };

  const metrics = useMemo(() => calculateMetrics(jobs, timePeriod), [jobs, timePeriod]);
  const jobsByType = useMemo(() => getJobsByType(jobs, timePeriod), [jobs, timePeriod]);
  const locationRevenue = useMemo(() => getLocationRevenue(jobs, timePeriod), [jobs, timePeriod]);
  const monthlyData = useMemo(() => getMonthlyData(jobs, timePeriod), [jobs, timePeriod]);
  const referralData = useMemo(() => getReferralSourceData(jobs, timePeriod), [jobs, timePeriod]);
  const clientTypeData = useMemo(() => getClientTypeData(jobs, timePeriod), [jobs, timePeriod]);
  const healthStatus = useMemo(() => getHealthStatus(metrics), [metrics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Business Analytics</h1>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <p>Comprehensive insights into your business performance</p>
            {lastUpdated && (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimePeriod('current_year')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timePeriod === 'current_year'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Current Year
          </button>
          <button
            onClick={() => setTimePeriod('all_time')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timePeriod === 'all_time'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">No jobs data available yet</p>
          <p className="text-sm text-slate-500">Add jobs to start seeing analytics</p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-6 border border-emerald-200 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Boxed2Built Health</h2>
                <p className="text-slate-600">Overall business performance indicator</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${healthStatus.color} mb-1`}>{healthStatus.status}</p>
                <p className="text-sm text-slate-600">Based on key metrics</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(metrics.totalRevenue)}
              subtitle={timePeriod === 'current_year' ? 'Year-to-Date' : 'All Time'}
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBgColor="bg-emerald-100"
            />
            <MetricCard
              title="Total Net Profit"
              value={formatCurrency(metrics.totalNetProfit)}
              subtitle={`${formatPercent(metrics.profitMarginPercent)} profit margin`}
              icon={TrendingUp}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100"
            />
            <MetricCard
              title="Profit per Hour"
              value={formatCurrency(metrics.profitPerHour)}
              subtitle="Average efficiency"
              icon={Clock}
              iconColor="text-teal-600"
              iconBgColor="bg-teal-100"
            />
            <MetricCard
              title="Avg Hourly Rate"
              value={formatCurrency(metrics.avgHourlyRate)}
              subtitle="Per hour worked"
              icon={Target}
              iconColor="text-amber-600"
              iconBgColor="bg-amber-100"
            />
            <MetricCard
              title="Jobs This Month"
              value={metrics.jobsThisMonth}
              subtitle={formatCurrency(metrics.revenueThisMonth)}
              icon={Calendar}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100"
            />
            <MetricCard
              title="Total Jobs"
              value={metrics.totalJobs}
              subtitle={timePeriod === 'current_year' ? 'This year' : 'All time'}
              icon={Briefcase}
              iconColor="text-slate-600"
              iconBgColor="bg-slate-100"
            />
            <MetricCard
              title="Repeat Clients"
              value={formatPercent(metrics.repeatClientPercent)}
              subtitle="Customer retention"
              icon={UserCheck}
              iconColor="text-emerald-600"
              iconBgColor="bg-emerald-100"
            />
            <MetricCard
              title="Avg Revenue/Job"
              value={formatCurrency(metrics.avgRevenuePerJob)}
              subtitle={`${metrics.avgHoursPerJob.toFixed(1)} hrs avg`}
              icon={Activity}
              iconColor="text-teal-600"
              iconBgColor="bg-teal-100"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Jobs by Type" subtitle="Distribution of job categories">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jobsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="type" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Jobs by City" subtitle="Geographic distribution">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={locationRevenue}
                    dataKey="count"
                    nameKey="city"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.city}: ${entry.count}`}
                  >
                    {locationRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Net Profit by Location" subtitle="Most profitable cities">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationRevenue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis dataKey="city" type="category" stroke="#64748b" style={{ fontSize: '12px' }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="netProfit" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Revenue by Referral Source" subtitle="Marketing channel effectiveness">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={referralData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="source" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="revenue" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-8">
            <ChartCard title="Monthly Revenue & Net Profit" subtitle="Financial performance over time" height="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Revenue"
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="Net Profit"
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Client Type Distribution" subtitle="Repeat vs new clients">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={clientTypeData}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.type}: ${entry.count} (${formatPercent(entry.percent)})`}
                  >
                    {clientTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Efficiency Ratios</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Profit Margin</p>
                    <p className="text-2xl font-bold text-slate-900">{formatPercent(metrics.profitMarginPercent)}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      metrics.profitMarginPercent >= 70
                        ? 'bg-emerald-100 text-emerald-800'
                        : metrics.profitMarginPercent >= 50
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {metrics.profitMarginPercent >= 70 ? 'Excellent' : metrics.profitMarginPercent >= 50 ? 'Good' : 'Fair'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Revenue per Hour</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.revenuePerHourRatio)}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      metrics.revenuePerHourRatio >= 60
                        ? 'bg-emerald-100 text-emerald-800'
                        : metrics.revenuePerHourRatio >= 40
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {metrics.revenuePerHourRatio >= 60 ? 'Excellent' : metrics.revenuePerHourRatio >= 40 ? 'Good' : 'Fair'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Quoted vs Final Price</p>
                    <p className="text-2xl font-bold text-slate-900">{formatPercent((metrics.quotedVsFinalRatio - 1) * 100)}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.1
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.1 ? 'Accurate' : 'Review'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
