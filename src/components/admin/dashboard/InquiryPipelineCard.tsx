import { AlertTriangle, CheckCircle2, Clock, Filter, type LucideIcon } from 'lucide-react';
import Panel from './Panel';
import type { ResponseTimeStats } from '../../../services/inquiryService';

interface InquiryPipelineCardProps {
  inquiries: { total: number; pending: number; converted: number; archived: number; conversionRate: number };
  responseTime: ResponseTimeStats | null;
}

function formatResponseTime(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

interface Speed {
  label: string;
  icon: LucideIcon;
  className: string;
}

/** Under an hour is fast, under four is fine, anything longer risks losing the lead. */
function speedOf(seconds: number): Speed {
  const hours = seconds / 3600;
  if (hours < 1) return { label: 'Fast', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (hours < 4) return { label: 'Fair', icon: Clock, className: 'bg-amber-50 text-amber-900 border-amber-200' };
  return { label: 'Slow', icon: AlertTriangle, className: 'bg-red-50 text-red-800 border-red-200' };
}

function ResponseRow({ label, seconds, sampleSize }: { label: string; seconds: number | null; sampleSize: number }) {
  const speed = seconds === null ? null : speedOf(seconds);
  const SpeedIcon = speed?.icon;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">
          {sampleSize > 0 ? `${sampleSize} ${sampleSize === 1 ? 'inquiry' : 'inquiries'} answered` : 'No answered inquiries'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-base font-semibold text-slate-900 tabular-nums">{formatResponseTime(seconds)}</span>
        {speed && SpeedIcon && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${speed.className}`}>
            <SpeedIcon className="h-3 w-3" aria-hidden="true" />
            {speed.label}
          </span>
        )}
      </div>
    </div>
  );
}

const SEGMENTS = [
  { key: 'converted', label: 'Became jobs', color: 'bg-emerald-600' },
  { key: 'pending', label: 'Pending', color: 'bg-amber-400' },
  { key: 'archived', label: 'Archived', color: 'bg-slate-300' },
] as const;

/**
 * Where inquiries end up and how quickly they get a reply — the two numbers
 * that decide how much of the incoming interest turns into booked work.
 */
export default function InquiryPipelineCard({ inquiries, responseTime }: InquiryPipelineCardProps) {
  const { total, conversionRate } = inquiries;

  return (
    <Panel title="Inquiry pipeline" icon={Filter} action={{ label: 'Inquiries', to: '/admin/inquiries' }}>
      {total === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No inquiries yet. Requests from your website will show up here.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{conversionRate}%</p>
              <p className="text-sm text-slate-600">of inquiries became jobs</p>
            </div>
            <p className="text-right text-sm text-slate-600">
              <span className="block text-xl font-semibold text-slate-900 tabular-nums">{total}</span>
              total {total === 1 ? 'inquiry' : 'inquiries'}
            </p>
          </div>

          <div
            className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={SEGMENTS.map(s => `${inquiries[s.key]} ${s.label.toLowerCase()}`).join(', ')}
          >
            {SEGMENTS.filter(s => inquiries[s.key] > 0).map(s => (
              <div key={s.key} className={s.color} style={{ flexGrow: inquiries[s.key], flexBasis: 0 }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {SEGMENTS.map(s => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} aria-hidden="true" />
                {s.label}
                <span className="font-semibold text-slate-900 tabular-nums">{inquiries[s.key]}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average time to first reply</p>
            <div className="divide-y divide-slate-100">
              <ResponseRow
                label="Last 30 days"
                seconds={responseTime?.avgSeconds30d ?? null}
                sampleSize={responseTime?.sampleSize30d ?? 0}
              />
              <ResponseRow
                label="All time"
                seconds={responseTime?.avgSecondsAllTime ?? null}
                sampleSize={responseTime?.sampleSizeAllTime ?? 0}
              />
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
