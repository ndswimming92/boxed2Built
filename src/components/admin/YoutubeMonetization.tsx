import { CheckCircle2, Circle } from 'lucide-react';
import type { YoutubeMonetization } from '../../services/apiPlatformService';
import { Notice, formatNumber } from './youtubeStatsShared';

const MAX_PROJECTION_DAYS = 365 * 5;

function projectDate(remaining: number, perDay: number | null | undefined, paceDays: number): string {
  if (remaining <= 0) return 'Goal reached';
  if (perDay === null || perDay === undefined || perDay <= 0) return 'Not enough recent growth to estimate';
  const days = Math.ceil(remaining / perDay);
  if (days > MAX_PROJECTION_DAYS) return 'More than 5 years away at this pace';
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `~${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at the last ${paceDays}-day pace`;
}

function ProgressRow({
  label,
  sublabel,
  current,
  goal,
  estimate,
  format = formatNumber,
}: {
  label: string;
  sublabel: string;
  current: number | null;
  goal: number;
  estimate: string;
  format?: (n: number) => string;
}) {
  const value = current ?? 0;
  const pct = Math.min(100, (value / goal) * 100);
  const done = current !== null && current >= goal;
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-2">
          {done ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900">{label}</h3>
            <p className="text-xs sm:text-sm text-slate-500">{sublabel}</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 text-right tabular-nums whitespace-nowrap">
          <span className="font-semibold text-slate-900">{current === null ? '—' : format(current)}</span>
          {' / '}
          {format(goal)}
        </p>
      </div>
      <div
        className="h-3 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(value, goal)}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${Math.max(pct, current ? 1 : 0)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 text-xs sm:text-sm text-slate-600">
        <span className="tabular-nums">{pct.toFixed(pct < 10 ? 1 : 0)}% there</span>
        <span className="text-right">{estimate}</span>
      </div>
    </div>
  );
}

/**
 * Progress toward the YouTube Partner Program thresholds shown on Studio's
 * "Earn" page: subscribers AND (watch hours OR Shorts views).
 */
export default function YoutubeMonetizationCard({ data }: { data: YoutubeMonetization | undefined }) {
  if (!data) {
    return <Notice tone="amber" title="Monetization progress unavailable" />;
  }

  const { goals, pace } = data;
  const subsRemaining = goals.subscribers - (data.subscribers ?? 0);
  const hoursRemaining = goals.watch_hours - (data.watch_hours_365 ?? 0);
  const shortsProjected90 =
    pace.shorts_views === null ? null : Math.round((pace.shorts_views / pace.days) * 90);

  const subsOk = data.subscribers !== null && data.subscribers >= goals.subscribers;
  const hoursOk = data.watch_hours_365 !== null && data.watch_hours_365 >= goals.watch_hours;
  const shortsOk = data.shorts_views_90 !== null && data.shorts_views_90 >= goals.shorts_views;
  const eligible = subsOk && (hoursOk || shortsOk);

  return (
    <div className="space-y-4">
      {data.error && <Notice tone="amber" title="Some monetization numbers couldn't be loaded">{data.error}</Notice>}

      <div
        className={`p-4 rounded-lg border text-sm ${
          eligible ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {eligible ? (
          <p className="font-medium">
            You appear to meet the YouTube Partner Program thresholds. Check Studio → Earn to apply.
          </p>
        ) : (
          <p>
            To qualify you need <span className="font-medium">{formatNumber(goals.subscribers)} subscribers</span> and{' '}
            <span className="font-medium">one of</span> {formatNumber(goals.watch_hours)} watch hours (last 365 days) or{' '}
            {formatNumber(goals.shorts_views)} Shorts views (last 90 days).
          </p>
        )}
      </div>

      <ProgressRow
        label="Subscribers"
        sublabel="Required, plus one of the two below"
        current={data.subscribers}
        goal={goals.subscribers}
        estimate={projectDate(subsRemaining, pace.subscribers_net === null ? null : pace.subscribers_net / pace.days, pace.days)}
      />

      <p className="text-center text-sm font-medium text-slate-500">and one of the following</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressRow
          label="Watch hours"
          sublabel="Last 365 days"
          current={data.watch_hours_365}
          goal={goals.watch_hours}
          format={(n) => Math.round(n).toLocaleString()}
          estimate={projectDate(hoursRemaining, pace.watch_hours === null ? null : pace.watch_hours / pace.days, pace.days)}
        />
        <ProgressRow
          label="Shorts views"
          sublabel="Last 90 days"
          current={data.shorts_views_90}
          goal={goals.shorts_views}
          estimate={
            shortsProjected90 === null
              ? 'Not enough data to estimate'
              : shortsOk
                ? 'Goal reached'
                : `Last ${pace.days} days projects to ~${formatNumber(shortsProjected90)} per 90 days`
          }
        />
      </div>

      <p className="text-xs text-slate-500">
        These are estimates from the YouTube Analytics API, which counts all watch time and Shorts views and can lag
        by about two days. YouTube only counts <em>qualified</em> public views and hours, so Studio → Earn is the
        official number and may be a little lower. Estimated dates assume your last {pace.days} days continue
        unchanged; the 365-day and 90-day totals are rolling, so older activity drops off over time.
      </p>
    </div>
  );
}
