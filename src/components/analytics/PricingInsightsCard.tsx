import { useState } from 'react';
import { DollarSign, TrendingUp, CheckCircle2, RotateCcw } from 'lucide-react';
import { PricingRecommendation } from '../../services/analyticsService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface PricingInsightsCardProps {
  recommendations: PricingRecommendation[];
  /** The target rate currently in effect. */
  targetRate: number;
  /** Average profit per hour over the last 3 months, or null if there is no recent paid work. */
  autoTargetRate: number | null;
  /** Paid jobs behind `autoTargetRate`. */
  autoTargetJobCount: number;
  /** True when the owner has typed their own target instead of the automatic one. */
  isCustomTarget: boolean;
  onTargetRateChange: (rate: number) => void;
  onResetTargetRate: () => void;
}

type Status = 'below' | 'on' | 'above';

/** Within this share of the target, a job type counts as "on target". */
const ON_TARGET_TOLERANCE = 0.05;

const STATUS_STYLES: Record<Status, { label: string; pill: string; accent: string; value: string; bar: string }> = {
  below: {
    label: 'Below target',
    pill: 'bg-amber-100 text-amber-800',
    accent: 'border-l-amber-400',
    value: 'text-amber-700',
    bar: 'bg-amber-400',
  },
  on: {
    label: 'On target',
    pill: 'bg-slate-100 text-slate-700',
    accent: 'border-l-slate-300',
    value: 'text-slate-700',
    bar: 'bg-slate-400',
  },
  above: {
    label: 'Above target',
    pill: 'bg-emerald-100 text-emerald-800',
    accent: 'border-l-emerald-500',
    value: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
};

function getStatus(rec: PricingRecommendation): Status {
  if (rec.targetHourlyRate <= 0) return 'on';
  const gap = (rec.currentAvgHourlyRate - rec.targetHourlyRate) / rec.targetHourlyRate;
  if (gap < -ON_TARGET_TOLERANCE) return 'below';
  if (gap > ON_TARGET_TOLERANCE) return 'above';
  return 'on';
}

const STATUS_ORDER: Record<Status, number> = { below: 0, on: 1, above: 2 };

export default function PricingInsightsCard({
  recommendations,
  targetRate,
  autoTargetRate,
  autoTargetJobCount,
  isCustomTarget,
  onTargetRateChange,
  onResetTargetRate,
}: PricingInsightsCardProps) {
  const { maskFinancialValue, privacyModeEnabled } = usePrivacyMode();

  // While the box is focused it shows exactly what was typed (so it can be
  // cleared mid-edit); otherwise it mirrors the target rate in effect.
  const [draft, setDraft] = useState<string | null>(null);

  // The automatic target is real earnings data, so privacy mode hides it like
  // every other amount on the card. Clicking in starts from an empty box
  // rather than revealing it; whatever is typed is hidden again on blur.
  const targetMasked = privacyModeEnabled && draft === null;

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    return maskFinancialValue(formatted);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const parsed = Number(value);
    if (value.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
      onTargetRateChange(parsed);
    }
  };

  // Job types that need attention first, biggest shortfall at the top.
  const rows = recommendations
    .map(rec => ({ rec, status: getStatus(rec), gap: rec.currentAvgHourlyRate - rec.targetHourlyRate }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.gap - b.gap);

  const targetSource = isCustomTarget
    ? 'Custom target'
    : autoTargetRate !== null
      ? `Your average over the last 3 months (${autoTargetJobCount} paid ${autoTargetJobCount === 1 ? 'job' : 'jobs'})`
      : 'Starting point — no paid jobs in the last 3 months to average yet';

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Pricing Intelligence</h3>
              <p className="text-xs sm:text-sm text-slate-600">
                What you earn per hour on each job type, compared with your target
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="flex items-center sm:justify-end gap-2">
              <label htmlFor="targetRate" className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Target rate
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  id="targetRate"
                  type={targetMasked ? 'text' : 'number'}
                  min="1"
                  step="5"
                  inputMode="decimal"
                  value={targetMasked ? '••••' : draft ?? String(targetRate)}
                  onFocus={() => {
                    if (privacyModeEnabled) setDraft('');
                  }}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onBlur={() => setDraft(null)}
                  aria-describedby="targetRateSource"
                  className="w-28 pl-7 pr-9 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">/hr</span>
              </div>
            </div>
            <p id="targetRateSource" className="mt-1.5 text-xs text-slate-500">
              {targetSource}
              {isCustomTarget && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={onResetTargetRate}
                    className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {autoTargetRate !== null
                      ? `Reset to average (${formatCurrency(autoTargetRate)}/hr)`
                      : 'Reset'}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {rows.length > 0 ? (
          <div className="space-y-4">
            {rows.map(({ rec, status, gap }) => {
              const styles = STATUS_STYLES[status];
              const scaleMax = Math.max(rec.currentAvgHourlyRate, rec.targetHourlyRate, 1);
              const currentPct = Math.max(0, Math.min(100, (rec.currentAvgHourlyRate / scaleMax) * 100));
              const targetPct = Math.max(0, Math.min(100, (rec.targetHourlyRate / scaleMax) * 100));
              const priceIncrease = rec.recommendedTarget - rec.avgPrice;

              return (
                <div
                  key={rec.jobType}
                  className={`rounded-lg border border-slate-200 border-l-4 ${styles.accent} p-4 sm:p-5`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">{rec.jobType}</h4>
                      <p className="text-xs text-slate-500">
                        {rec.sampleSize} jobs · about {rec.avgHours.toFixed(1)} hrs each
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles.pill}`}>
                      {styles.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:gap-6">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">You earn</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-900">
                        {formatCurrency(rec.currentAvgHourlyRate)}
                        <span className="text-sm font-medium text-slate-500">/hr</span>
                      </p>
                      <p className="text-xs text-slate-400">after materials</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Target</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-900">
                        {formatCurrency(rec.targetHourlyRate)}
                        <span className="text-sm font-medium text-slate-500">/hr</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Difference</p>
                      <p className={`text-xl sm:text-2xl font-bold ${styles.value}`}>
                        {Math.round(gap) === 0 ? '' : gap > 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(gap))}
                        <span className="text-sm font-medium">/hr</span>
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-4 h-2 rounded-full bg-slate-100" aria-hidden="true">
                    <div className={`h-2 rounded-full ${styles.bar}`} style={{ width: `${currentPct}%` }} />
                    <div
                      className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-700"
                      style={{ left: `calc(${targetPct}% - 1px)` }}
                    />
                  </div>

                  <div className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                    {status === 'below' ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p>
                          Average job price is {formatCurrency(rec.avgPrice)}. Raise it to about{' '}
                          <span className="font-semibold text-slate-900">{formatCurrency(rec.recommendedTarget)}</span>
                          {' '}(+{formatCurrency(priceIncrease)} per job) to reach your target.
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'above' ? 'text-emerald-600' : 'text-slate-400'}`}
                        />
                        <p>
                          Average job price is{' '}
                          <span className="font-semibold text-slate-900">{formatCurrency(rec.avgPrice)}</span>
                          {' '}(from {formatCurrency(rec.minPrice)} to {formatCurrency(rec.maxPrice)}).{' '}
                          {status === 'above'
                            ? 'You are beating your target — keep your pricing.'
                            : 'Your pricing is on target.'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2">No pricing recommendations available yet</p>
            <p className="text-sm text-slate-500">
              Complete at least 3 jobs per job type to see pricing insights
            </p>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Job types use the date range selected at the top of the page. The dark marker on each bar is your
            target rate. Introduce price increases gradually, starting with new customers.
          </p>
        </div>
      )}
    </div>
  );
}
