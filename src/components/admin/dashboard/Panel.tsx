import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  /** Short line under the title. */
  subtitle?: string;
  /** "View all"-style link in the header. */
  action?: { label: string; to: string };
  className?: string;
  children: ReactNode;
}

/** The white card every dashboard section sits in. */
export default function Panel({ title, icon: Icon, subtitle, action, className = '', children }: PanelProps) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action && (
          <Link
            to={action.to}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
