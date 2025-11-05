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
  getJobTypePerformance,
  getProfitabilityLeaderboard,
  getPricingRecommendations,
  getProfitMarginDistribution,
  getMaterialsCostAnalysis,
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
  Download,
  Upload,
} from 'lucide-react';
import ImportJobsModal from '../../components/admin/ImportJobsModal';
import { exportJobsToCSV, downloadCSV, generateExportFilename } from '../../services/jobExportService';
import ProfitabilityLeaderboard from '../../components/analytics/ProfitabilityLeaderboard';
import JobTypePerformanceTable from '../../components/analytics/JobTypePerformanceTable';
import PricingInsightsCard from '../../components/analytics/PricingInsightsCard';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function AnalyticsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('current_year');
  const [showImportModal, setShowImportModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [targetHourlyRate, setTargetHourlyRate] = useState(50);
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

  const jobTypePerformance = useMemo(() => getJobTypePerformance(jobs, timePeriod), [jobs, timePeriod]);
  const profitabilityLeaderboard = useMemo(() => getProfitabilityLeaderboard(jobs, timePeriod, 10), [jobs, timePeriod]);
  const pricingRecommendations = useMemo(
    () => getPricingRecommendations(jobs, timePeriod, targetHourlyRate),
    [jobs, timePeriod, targetHourlyRate]
  );
  const profitMarginDistribution = useMemo(() => getProfitMarginDistribution(jobs, timePeriod), [jobs, timePeriod]);
  const materialsCostAnalysis = useMemo(() => getMaterialsCostAnalysis(jobs, timePeriod), [jobs, timePeriod]);

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

  const handleExportJobs = () => {
    const jobsToExport = timePeriod === 'current_year'
      ? jobs.filter(job => {
          const year = new Date(job.created_at).getFullYear();
          return year === new Date().getFullYear();
        })
      : jobs;

    const csv = exportJobsToCSV(jobsToExport);
    const filename = generateExportFilename();
    downloadCSV(csv, filename);
    setMessage({ type: 'success', text: `Exported ${jobsToExport.length} jobs successfully!` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportSuccess = (count: number) => {
    setMessage({ type: 'success', text: `Successfully imported ${count} jobs!` });
    setTimeout(() => setMessage(null), 3000);
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
            onClick={handleExportJobs}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            title="Export jobs to CSV"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            title="Import jobs from CSV"
          >
            <Upload className="w-5 h-5" />
            Import
          </button>
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

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

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
                <div className="flex flex-col p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
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
                  <p className="text-xs text-slate-500">
                    Revenue after materials cost. Excellent: 70%+, Good: 50-70%, Fair: &lt;50%
                  </p>
                </div>
                <div className="flex flex-col p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
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
                  <p className="text-xs text-slate-500">
                    Hourly earnings from jobs. Excellent: $60+/hr, Good: $40-60/hr, Fair: &lt;$40/hr
                  </p>
                </div>
                <div className="flex flex-col p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Quoted vs Final Price</p>
                      <p className="text-2xl font-bold text-slate-900">{formatPercent((metrics.quotedVsFinalRatio - 1) * 100)}</p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.05
                          ? 'bg-emerald-100 text-emerald-800'
                          : Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.15
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.05
                        ? 'Excellent'
                        : Math.abs(metrics.quotedVsFinalRatio - 1) <= 0.15
                        ? 'Good'
                        : 'Review'}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Quote accuracy vs final price. Excellent: ±5%, Good: ±15%, Review: &gt;±15%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t-4 border-slate-200">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Profitability & Pricing Intelligence</h2>
              <p className="text-slate-600">Deep dive into your most and least profitable jobs, pricing strategies, and optimization opportunities</p>
            </div>

            <div className="mb-8">
              <PricingInsightsCard
                recommendations={pricingRecommendations}
                defaultTargetRate={targetHourlyRate}
                onTargetRateChange={setTargetHourlyRate}
              />
            </div>

            <div className="mb-8">
              <JobTypePerformanceTable performance={jobTypePerformance} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartCard title="Profit Margin Distribution" subtitle="Jobs by profit margin quality">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitMarginDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" stroke="#64748b" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Materials Cost Analysis</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {materialsCostAnalysis.length > 0 ? (
                    materialsCostAnalysis.map((analysis) => (
                      <div key={analysis.jobType} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{analysis.jobType}</p>
                            <p className="text-xs text-slate-500">{analysis.count} jobs</p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              analysis.avgMaterialsPercent > 40
                                ? 'bg-red-100 text-red-800'
                                : analysis.avgMaterialsPercent > 30
                                ? 'bg-amber-100 text-amber-800'
                                : analysis.avgMaterialsPercent > 20
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {formatPercent(analysis.avgMaterialsPercent)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Avg: {formatCurrency(analysis.avgMaterialsCost)}</span>
                          <span className="text-slate-500">{analysis.suggestion}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-slate-500">No materials cost data available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <ProfitabilityLeaderboard
                topJobs={profitabilityLeaderboard.topJobs}
                bottomJobs={profitabilityLeaderboard.bottomJobs}
              />
            </div>
          </div>
        </>
      )}

      {showImportModal && businessId && (
        <ImportJobsModal
          businessId={businessId}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
