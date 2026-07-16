import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Wallet,
  Flame,
  CalendarClock,
  TrendingDown,
  Plus,
  CreditCard as Edit,
  Trash2,
  Repeat,
  AlertTriangle,
  Hourglass,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getLatestBalance,
  recordBalance,
  computeBurnMetrics,
  projectBurndown,
  upcomingPayments,
  subscriptionCostBreakdown,
  monthlyAmount,
  annualAmount,
  cycleLabel,
  type Subscription,
  type BalanceSnapshot,
} from '../../services/burnRateService';
import SubscriptionFormModal from '../../components/admin/SubscriptionFormModal';
import BalanceUpdateModal from '../../components/admin/BalanceUpdateModal';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

// Categorical palette (matches the app's chart colors on the Finances page).
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#06b6d4', '#f97316'];

export default function BurnRatePage() {
  const { maskFinancialValue } = usePrivacyMode();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [latestBalance, setLatestBalance] = useState<BalanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  useEffect(() => {
    const fetchBusinessId = async () => {
      const { data } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (data) setBusinessId(data.id);
      else setLoading(false);
    };
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [subs, balance] = await Promise.all([
        getSubscriptions(businessId),
        getLatestBalance(businessId),
      ]);
      setSubscriptions(subs);
      setLatestBalance(balance);
    } catch (error) {
      console.error('Error loading burn rate data:', error);
      setMessage({ type: 'error', text: 'Failed to load burn rate data' });
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = latestBalance?.balance ?? 0;

  const metrics = useMemo(
    () => computeBurnMetrics(subscriptions, currentBalance),
    [subscriptions, currentBalance]
  );

  const burndown = useMemo(
    () => projectBurndown(subscriptions, currentBalance),
    [subscriptions, currentBalance]
  );

  const upcoming = useMemo(() => upcomingPayments(subscriptions, 12), [subscriptions]);

  const costBreakdown = useMemo(() => subscriptionCostBreakdown(subscriptions), [subscriptions]);

  const formatCurrency = (value: number, opts?: { decimals?: boolean }) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: opts?.decimals ? 2 : 0,
      maximumFractionDigits: opts?.decimals ? 2 : 0,
    }).format(value);
    return maskFinancialValue(formatted);
  };

  const formatDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : '—';

  const runwayLabel = useMemo(() => {
    if (metrics.monthlyBurn <= 0) return 'No burn';
    if (metrics.runwayMonths == null) return '∞';
    if (metrics.runwayMonths >= 24) {
      return `${(metrics.runwayMonths / 12).toFixed(1)} yrs`;
    }
    return `${metrics.runwayMonths.toFixed(1)} mo`;
  }, [metrics]);

  const runwaySeverity = useMemo(() => {
    if (metrics.monthlyBurn <= 0 || metrics.runwayMonths == null) return 'ok';
    if (metrics.runwayMonths < 3) return 'critical';
    if (metrics.runwayMonths < 6) return 'warning';
    return 'ok';
  }, [metrics]);

  const handleSaveSubscription = async (data: Partial<Subscription>) => {
    if (!businessId) return;
    if (editingSub) {
      await updateSubscription(editingSub.id, data);
    } else {
      await createSubscription(data);
    }
    setShowSubModal(false);
    setEditingSub(null);
    setMessage({ type: 'success', text: 'Subscription saved.' });
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!confirm('Remove this subscription from your burn rate?')) return;
    const ok = await deleteSubscription(id);
    if (ok) {
      setMessage({ type: 'success', text: 'Subscription removed.' });
      setTimeout(() => setMessage(null), 3000);
      fetchData();
    } else {
      setMessage({ type: 'error', text: 'Failed to remove subscription.' });
    }
  };

  const handleSaveBalance = async (snapshot: Partial<BalanceSnapshot>) => {
    await recordBalance(snapshot);
    setShowBalanceModal(false);
    setMessage({ type: 'success', text: 'Balance updated.' });
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const hasBalance = latestBalance != null;
  const hasSubscriptions = subscriptions.length > 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
            Burn Rate &amp; Runway
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            See how fast your subscriptions burn through your cash — and when it runs out.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBalanceModal(true)}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            <span className="hidden sm:inline">Update Balance</span>
          </button>
          <button
            onClick={() => {
              setEditingSub(null);
              setShowSubModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Subscription</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {!hasBalance && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Set your starting balance</p>
            <p className="text-sm text-amber-800">
              Add your total cash on hand with{' '}
              <button
                onClick={() => setShowBalanceModal(true)}
                className="font-semibold underline hover:no-underline"
              >
                Update Balance
              </button>{' '}
              to calculate how long your money will last.
            </p>
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-1">Current Balance</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{formatCurrency(currentBalance)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {latestBalance
              ? `as of ${new Date(latestBalance.recorded_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}`
              : 'not set'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Flame className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-1">Monthly Burn</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">
            {formatCurrency(metrics.monthlyBurn)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {formatCurrency(metrics.annualBurn)}/yr
          </p>
        </div>

        <div
          className={`rounded-xl border p-3 sm:p-6 ${
            runwaySeverity === 'critical'
              ? 'bg-red-50 border-red-200'
              : runwaySeverity === 'warning'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${
                runwaySeverity === 'critical'
                  ? 'bg-red-100'
                  : runwaySeverity === 'warning'
                    ? 'bg-amber-100'
                    : 'bg-slate-100'
              }`}
            >
              <Hourglass
                className={`w-4 h-4 sm:w-6 sm:h-6 ${
                  runwaySeverity === 'critical'
                    ? 'text-red-600'
                    : runwaySeverity === 'warning'
                      ? 'text-amber-600'
                      : 'text-slate-600'
                }`}
              />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-1">Runway</p>
          <p
            className={`text-lg sm:text-2xl font-bold ${
              runwaySeverity === 'critical'
                ? 'text-red-700'
                : runwaySeverity === 'warning'
                  ? 'text-amber-700'
                  : 'text-slate-900'
            }`}
          >
            {runwayLabel}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.runwayDays != null ? `${metrics.runwayDays} days left` : 'balance stable'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-violet-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-4 h-4 sm:w-6 sm:h-6 text-violet-600" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-1">Projected Empty</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">
            {metrics.zeroDate ? formatDate(metrics.zeroDate) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.activeCount} active subscription{metrics.activeCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Burndown projection — headline chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cash Burndown Projection</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Balance over time as each subscription comes due
            </p>
          </div>
          <TrendingDown className="w-5 h-5 text-slate-400" />
        </div>
        {hasBalance && hasSubscriptions ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burndown.points} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="burndownFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" style={{ fontSize: '12px' }} minTickGap={16} />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value: number) => [formatCurrency(value, { decimals: true }), 'Balance']}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#burndownFill)"
                  name="Balance"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-slate-400 gap-2">
            <TrendingDown className="w-8 h-8" />
            <p>
              {!hasBalance
                ? 'Set your balance to see the projection'
                : 'Add subscriptions to project your burn'}
            </p>
          </div>
        )}
        {metrics.zeroDate && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <CalendarClock className="w-4 h-4 text-violet-500" />
            At your current burn, your balance reaches{' '}
            <strong className="text-slate-900">$0 around {formatDate(metrics.zeroDate)}</strong>.
          </div>
        )}
      </div>

      {/* Two-up: upcoming payments + cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Payments (12 mo)</h2>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          {hasSubscriptions ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={upcoming} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" style={{ fontSize: '12px' }} minTickGap={8} />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(v: number) => formatCurrency(v)}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value, { decimals: true }), 'Due']}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Amount due" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-400">
              <p>No subscriptions yet</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Monthly Cost Breakdown</h2>
            <PieChartIcon className="w-5 h-5 text-slate-400" />
          </div>
          {costBreakdown.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdown}
                    dataKey="monthly"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      Number(percent ?? 0) > 0.06 ? `${name}` : ''
                    }
                    labelLine={false}
                  >
                    {costBreakdown.map((_slice, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    formatter={(value: number, _n, entry: { payload?: { billing_cycle?: string } }) => [
                      `${formatCurrency(value, { decimals: true })}/mo`,
                      entry?.payload?.billing_cycle
                        ? cycleLabel(entry.payload.billing_cycle as Subscription['billing_cycle'])
                        : 'Monthly',
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value: string) => (
                      <span style={{ color: '#475569', fontSize: '12px' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-400">
              <p>No subscriptions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Subscriptions</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {metrics.activeCount} active · {formatCurrency(metrics.monthlyBurn)}/mo ·{' '}
              {formatCurrency(metrics.annualBurn)}/yr
            </p>
          </div>
          <button
            onClick={() => {
              setEditingSub(null);
              setShowSubModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Billing
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Monthly
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Next Due
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {subscriptions.length > 0 ? (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{sub.name}</div>
                      {sub.description && (
                        <div className="text-xs text-slate-500">{sub.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {sub.category ? (
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs">{sub.category}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="w-3.5 h-3.5 text-slate-400" />
                        {cycleLabel(sub.billing_cycle)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                      {formatCurrency(sub.amount, { decimals: true })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">
                      {formatCurrency(monthlyAmount(sub), { decimals: true })}
                      <span className="block text-xs text-slate-400">
                        {formatCurrency(annualAmount(sub))}/yr
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {sub.next_due_date
                        ? new Date(sub.next_due_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingSub(sub);
                            setShowSubModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubscription(sub.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No subscriptions yet. Click "Add Subscription" to start tracking your burn rate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {businessId && (
        <SubscriptionFormModal
          isOpen={showSubModal}
          onClose={() => {
            setShowSubModal(false);
            setEditingSub(null);
          }}
          onSave={handleSaveSubscription}
          subscription={editingSub}
          businessId={businessId}
        />
      )}

      {businessId && (
        <BalanceUpdateModal
          isOpen={showBalanceModal}
          onClose={() => setShowBalanceModal(false)}
          onSave={handleSaveBalance}
          businessId={businessId}
          currentBalance={latestBalance?.balance ?? null}
        />
      )}
    </div>
  );
}
