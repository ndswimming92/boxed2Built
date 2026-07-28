import { useEffect, useState } from 'react';
import {
  DollarSign,
  Wallet,
  PiggyBank,
  Gauge,
  RefreshCw,
  AlertCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getClaudeUsage,
  updateClaudeUsageBudget,
  ClaudeUsage,
} from '../../services/claudeUsageService';
import MetricCard from '../../components/analytics/MetricCard';
import ChartCard from '../../components/analytics/ChartCard';

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTrendDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function ClaudeUsagePage() {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getClaudeUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Claude usage.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startEditingBudget = () => {
    if (!usage) return;
    setBudgetInput(String(usage.budget_usd));
    setEditingBudget(true);
  };

  const saveBudget = async () => {
    const parsed = Number(budgetInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSavingBudget(true);
    try {
      await updateClaudeUsageBudget(parsed);
      setEditingBudget(false);
      await fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget.');
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error && !usage) {
    return (
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Claude Usage</h1>
          <p className="text-sm sm:text-base text-slate-600">Anthropic API token usage and spend.</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const isOverBudget = usage.budget_usd > 0 && usage.remaining_usd < 0;

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Claude Usage</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Anthropic API token usage and spend for this billing month.
          </p>
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Spent This Month"
          value={formatUsd(usage.spent_this_month_usd)}
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />

        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-slate-100 rounded-lg">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-600">Monthly Budget</p>
            </div>
            {!editingBudget && (
              <button onClick={startEditingBudget} className="text-slate-400 hover:text-slate-600">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingBudget ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full px-2 py-1 text-lg font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={saveBudget}
                disabled={savingBudget}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingBudget(false)}
                disabled={savingBudget}
                className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              {usage.budget_usd > 0 ? formatUsd(usage.budget_usd) : 'Not set'}
            </p>
          )}
        </div>

        <MetricCard
          title="Remaining"
          value={usage.budget_usd > 0 ? formatUsd(usage.remaining_usd) : '—'}
          subtitle={usage.budget_usd > 0 ? undefined : 'Set a budget to track remaining spend'}
          icon={PiggyBank}
          iconColor={isOverBudget ? 'text-red-600' : 'text-emerald-600'}
          iconBgColor={isOverBudget ? 'bg-red-100' : 'bg-emerald-100'}
          trend={isOverBudget ? { value: 'Over budget', positive: false } : undefined}
        />

        <MetricCard
          title="% of Budget Used"
          value={usage.percent_used !== null ? `${usage.percent_used.toFixed(1)}%` : '—'}
          icon={Gauge}
          iconColor={
            usage.percent_used !== null && usage.percent_used >= 100
              ? 'text-red-600'
              : usage.percent_used !== null && usage.percent_used >= 80
              ? 'text-amber-600'
              : 'text-emerald-600'
          }
          iconBgColor={
            usage.percent_used !== null && usage.percent_used >= 100
              ? 'bg-red-100'
              : usage.percent_used !== null && usage.percent_used >= 80
              ? 'bg-amber-100'
              : 'bg-emerald-100'
          }
        />
      </div>

      {usage.trend.length > 0 && (
        <div className="mb-8">
          <ChartCard title="Daily Spend" subtitle="Last 31 days, in USD">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usage.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={formatTrendDate} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip labelFormatter={formatTrendDate} formatter={(v: number) => formatUsd(v)} />
                <Area type="monotone" dataKey="cost_usd" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">Usage by Model</h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">This billing month, token counts and cost.</p>
        </div>
        {usage.by_model.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No usage recorded yet this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 sm:px-6 py-3 font-medium">Model</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Input Tokens</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Output Tokens</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Cache Read</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Cache Write</th>
                  <th className="px-4 sm:px-6 py-3 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.by_model.map((row) => (
                  <tr key={row.model} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 sm:px-6 py-3 font-medium text-slate-900">{row.model}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-slate-700">{formatTokens(row.input_tokens)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-slate-700">{formatTokens(row.output_tokens)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-slate-700">{formatTokens(row.cache_read_tokens)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-slate-700">{formatTokens(row.cache_creation_tokens)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-medium text-slate-900">{formatUsd(row.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Last updated {new Date(usage.fetched_at).toLocaleString()}. Data from Anthropic typically lags live usage by a few minutes.
      </p>
    </div>
  );
}
