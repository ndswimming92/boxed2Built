import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { PeriodComparison } from '../../../utils/dashboardTrends';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  to: string;
  /** Supporting line under the value, e.g. "$1,240 this month". */
  detail?: ReactNode;
  /** Month-to-date change against the same stretch of last month. */
  comparison?: PeriodComparison;
}

function Delta({ comparison }: { comparison: PeriodComparison }) {
  const { percentChange } = comparison;
  // Nothing last month to compare against: say nothing rather than invent a figure.
  if (percentChange === null) return null;

  const rounded = Math.round(percentChange);
  if (rounded === 0) {
    return <span className="text-xs font-medium text-slate-500">Level with last month</span>;
  }

  const up = rounded > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-0.5 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}
      title="This month so far, against the same days of last month"
    >
      <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="whitespace-nowrap">{up ? 'Up' : 'Down'} {Math.abs(rounded)}%</span>
      <span className="whitespace-nowrap pl-1 font-normal text-slate-500">vs last month</span>
    </span>
  );
}

/** One of the headline numbers at the top of the dashboard. */
export default function KpiCard({ label, value, icon: Icon, to, detail, comparison }: KpiCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="rounded-lg bg-slate-100 p-2 text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl">{value}</p>
      <div className="mt-2 flex min-h-5 flex-col gap-0.5">
        {detail && <p className="text-xs text-slate-600">{detail}</p>}
        {comparison && <Delta comparison={comparison} />}
      </div>
    </Link>
  );
}
