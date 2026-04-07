import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeJobs } from '../../hooks/useRealtimeJobs';
import {
  generateForecast,
  saveForecastSettings,
  loadForecastSettings,
  saveForecastData,
  exportForecastToCSV,
  ForecastSettings,
  ForecastResult,
  ForecastDataPoint,
} from '../../services/forecastingService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  Briefcase,
  Download,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  BarChart3,
} from 'lucide-react';

export default function ForecastingPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { jobs, loading: jobsLoading } = useRealtimeJobs(businessId);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState<ForecastSettings>({
    businessId: '',
    forecastMonths: 12,
    growthRateOverride: null,
    seasonalityEnabled: true,
    modelPreference: 'auto',
    confidenceLevel: 95,
  });

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      setSettings(prev => ({ ...prev, businessId }));
      loadSettings();
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId && jobs.length > 0) {
      generateForecastData();
    }
  }, [businessId, jobs]);

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

  const loadSettings = async () => {
    if (!businessId) return;

    const savedSettings = await loadForecastSettings(businessId);
    if (savedSettings) {
      setSettings(savedSettings);
    }
  };

  const generateForecastData = async () => {
    if (!businessId || jobs.length === 0) return;

    setLoading(true);
    try {
      const result = await generateForecast(jobs, settings);
      setForecastResult(result);

      await saveForecastSettings(settings);
      await saveForecastData(businessId, result.forecasts, settings.modelPreference);

      setMessage({ type: 'success', text: 'Forecast generated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error generating forecast:', error);
      setMessage({ type: 'error', text: 'Failed to generate forecast' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleExportForecast = () => {
    if (!forecastResult) return;

    const csv = exportForecastToCSV(forecastResult.forecasts);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-forecast-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setMessage({ type: 'success', text: 'Forecast exported successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = useMemo(() => {
    if (!forecastResult) return [];

    return forecastResult.forecasts.map(f => ({
      date: f.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      revenue: f.isHistorical ? f.actualRevenue : null,
      forecast: !f.isHistorical ? f.predictedRevenue : null,
      lower: !f.isHistorical ? f.confidenceLower : null,
      upper: !f.isHistorical ? f.confidenceUpper : null,
    }));
  }, [forecastResult]);

  const nextMonthForecast = useMemo(() => {
    if (!forecastResult) return null;
    const future = forecastResult.forecasts.filter(f => !f.isHistorical);
    return future.length > 0 ? future[0] : null;
  }, [forecastResult]);

  const nextQuarterForecast = useMemo(() => {
    if (!forecastResult) return null;
    const future = forecastResult.forecasts.filter(f => !f.isHistorical);
    const quarterRevenue = future.slice(0, 3).reduce((sum, f) => sum + f.predictedRevenue, 0);
    const quarterJobs = future.slice(0, 3).reduce((sum, f) => sum + f.predictedJobCount, 0);
    return { revenue: quarterRevenue, jobs: quarterJobs };
  }, [forecastResult]);

  const nextYearForecast = useMemo(() => {
    if (!forecastResult) return null;
    const future = forecastResult.forecasts.filter(f => !f.isHistorical);
    const yearRevenue = future.slice(0, 12).reduce((sum, f) => sum + f.predictedRevenue, 0);
    const yearJobs = future.slice(0, 12).reduce((sum, f) => sum + f.predictedJobCount, 0);
    return { revenue: yearRevenue, jobs: yearJobs };
  }, [forecastResult]);

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    return maskFinancialValue(formatted);
  };

  const getTrendIcon = () => {
    if (!forecastResult) return Minus;
    switch (forecastResult.trend) {
      case 'increasing':
        return TrendingUp;
      case 'decreasing':
        return TrendingDown;
      default:
        return Minus;
    }
  };

  const getTrendColor = () => {
    if (!forecastResult) return 'text-slate-600';
    switch (forecastResult.trend) {
      case 'increasing':
        return 'text-emerald-600';
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  if (jobsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Revenue Forecasting</h1>
          <p className="text-slate-600">Predict future revenue based on historical job data</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-2">Not enough data to generate forecasts</p>
          <p className="text-sm text-slate-500">Add at least 3 completed jobs to start forecasting</p>
        </div>
      </div>
    );
  }

  const TrendIcon = getTrendIcon();

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Revenue Forecasting</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Predict future revenue based on {jobs.filter(j => j.date_completed).length} completed jobs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 sm:px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={generateForecastData}
            disabled={loading}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
          <button
            onClick={handleExportForecast}
            disabled={!forecastResult}
            className="px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {showSettings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Forecast Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Forecast Period (Months)</label>
              <input name="forecastMonths"
                type="number"
                min="1"
                max="24"
                value={settings.forecastMonths}
                onChange={(e) => setSettings({ ...settings, forecastMonths: parseInt(e.target.value) || 12 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Model Preference</label>
              <select name="modelPreference"
                value={settings.modelPreference}
                onChange={(e) => setSettings({ ...settings, modelPreference: e.target.value as any })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="auto">Auto (Best Fit)</option>
                <option value="linear">Linear Regression</option>
                <option value="exponential">Exponential Smoothing</option>
                <option value="seasonal">Seasonal Decomposition</option>
                <option value="ensemble">Ensemble (Combined)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Growth Rate Override (%)</label>
              <input name="growthRateOverride"
                type="number"
                step="0.1"
                value={settings.growthRateOverride || ''}
                onChange={(e) => setSettings({ ...settings, growthRateOverride: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Auto calculated"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty for automatic calculation</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="seasonality"
                checked={settings.seasonalityEnabled}
                onChange={(e) => setSettings({ ...settings, seasonalityEnabled: e.target.checked })}
                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <label htmlFor="seasonality" className="text-sm font-medium text-slate-700">
                Enable Seasonality Adjustments
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={generateForecastData}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Apply Settings & Regenerate
            </button>
          </div>
        </div>
      )}

      {forecastResult && (
        <>
          <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl p-6 border border-blue-200 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Forecast Summary
                </h2>
                <p className="text-sm text-slate-600">
                  Based on {settings.modelPreference === 'auto' ? 'automatic model selection' : settings.modelPreference} analysis
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-600 mb-1">Trend Direction</p>
                  <div className={`flex items-center gap-2 ${getTrendColor()}`}>
                    <TrendIcon className="w-6 h-6" />
                    <span className="font-bold capitalize">{forecastResult.trend}</span>
                  </div>
                </div>
                {forecastResult.seasonalityDetected && (
                  <div className="px-4 py-2 bg-blue-100 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-800">Seasonality Detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
            {nextMonthForecast && (
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Next Month</p>
                    <p className="text-xs text-slate-500">
                      {nextMonthForecast.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  {formatCurrency(nextMonthForecast.predictedRevenue)}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{nextMonthForecast.predictedJobCount} jobs</span>
                  <span className="text-slate-500">
                    ±{formatCurrency(nextMonthForecast.confidenceUpper - nextMonthForecast.predictedRevenue)}
                  </span>
                </div>
              </div>
            )}

            {nextQuarterForecast && (
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Next Quarter</p>
                    <p className="text-xs text-slate-500">3 months ahead</p>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  {formatCurrency(nextQuarterForecast.revenue)}
                </p>
                <p className="text-sm text-slate-600">{nextQuarterForecast.jobs} jobs</p>
              </div>
            )}

            {nextYearForecast && (
              <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Briefcase className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Next 12 Months</p>
                    <p className="text-xs text-slate-500">Annual forecast</p>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  {formatCurrency(nextYearForecast.revenue)}
                </p>
                <p className="text-sm text-slate-600">{nextYearForecast.jobs} jobs</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue Forecast with Confidence Intervals</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    fill="url(#confidenceGradient)"
                    name="Upper Bound"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="none"
                    fill="#fff"
                    name="Lower Bound"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Historical Revenue"
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    name="Forecasted Revenue"
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Forecast Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Month</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Revenue</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Jobs</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Confidence Range</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastResult.forecasts.slice(-18).map((forecast, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {forecast.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="text-right py-3 px-4 text-sm font-medium text-slate-900">
                        {formatCurrency(forecast.isHistorical ? forecast.actualRevenue! : forecast.predictedRevenue)}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-slate-700">
                        {forecast.isHistorical ? forecast.actualJobCount : forecast.predictedJobCount}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-slate-600">
                        {!forecast.isHistorical && (
                          <>
                            {formatCurrency(forecast.confidenceLower)} - {formatCurrency(forecast.confidenceUpper)}
                          </>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            forecast.isHistorical
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {forecast.isHistorical ? 'Historical' : 'Forecast'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
