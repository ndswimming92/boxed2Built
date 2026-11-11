import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, type LucideIcon } from 'lucide-react';

export interface AttentionItem {
  key: string;
  icon: LucideIcon;
  count: number;
  /** Reads after the count: "2 inquiries waiting on a reply". */
  label: string;
  /** Extra context, e.g. "1 overdue". */
  note?: string;
  to: string;
  /** Urgent items are past due; the rest are simply waiting. */
  urgent?: boolean;
}

/**
 * The first thing on the dashboard: what needs doing today. Items with nothing
 * outstanding drop out entirely, and an empty list collapses to a single
 * "all caught up" line instead of a row of zeros.
 */
export default function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const open = items.filter(item => item.count > 0);

  if (open.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        All caught up — no inquiries, reminders or goals need you right now.
      </div>
    );
  }

  return (
    <section aria-label="Needs attention">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Needs attention</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {open.map(item => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={`group flex h-full items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  item.urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <span className={`rounded-lg p-2 ${item.urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    <span className="tabular-nums">{item.count}</span> {item.label}
                  </span>
                  {item.note && (
                    <span className={`block text-xs font-medium ${item.urgent ? 'text-red-800' : 'text-amber-900'}`}>
                      {item.note}
                    </span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
