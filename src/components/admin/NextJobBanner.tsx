import { Link } from 'react-router-dom';
import type { Job } from '../../lib/supabase';
import { formatDate } from '../../utils/jobCalculations';
import { getDirectionsUrl, resolveWorkAddress } from '../../utils/jobAddress';
import { formatTimeOfDay } from '../../utils/nextJob';

interface NextJobBannerProps {
  job: Job;
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-slate-500">{name}:</span>
      {children}
    </span>
  );
}

export default function NextJobBanner({ job }: NextJobBannerProps) {
  const start = formatTimeOfDay(job.scheduled_start_time);
  const end = formatTimeOfDay(job.scheduled_end_time);
  const time = start ? (end ? `${start} – ${end}` : start) : 'unset';
  const address = resolveWorkAddress(job);
  const phoneHref = job.client_phone ? `tel:${job.client_phone.replace(/[^\d+]/g, '')}` : null;

  return (
    // The whole banner opens the job via the overlay link; the phone and address are real links
    // sitting above it, since anchors can't be nested.
    <div className="group relative mb-6 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 font-mono text-[13px] shadow-sm transition-colors hover:border-emerald-500/60">
      <Link
        to={`/admin/jobs?job=${job.id}`}
        aria-label={`View job for ${job.client_name}`}
        className="absolute inset-0 z-0 rounded-lg"
      />

      <div className="pointer-events-none relative flex items-center gap-2 border-b border-slate-700/70 bg-slate-800/60 px-4 py-1.5 text-xs">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="ml-2 text-slate-400">
          <span className="text-emerald-400">$</span> next_job
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-emerald-400" aria-hidden="true" />
        </span>
        <span className="ml-auto text-slate-500 transition-colors group-hover:text-emerald-400">
          view_job →
        </span>
      </div>

      <div className="pointer-events-none relative flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3 text-slate-200">
        <Field name="when">
          <span className="text-amber-300">
            {formatDate(job.date_scheduled)} <span className="text-slate-500">@</span> {time}
          </span>
        </Field>
        <Field name="customer">
          <span className="font-semibold text-white">"{job.client_name}"</span>
        </Field>
        {job.client_phone && phoneHref && (
          <Field name="phone">
            <a
              href={phoneHref}
              className="pointer-events-auto relative text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 hover:decoration-cyan-300"
            >
              {job.client_phone}
            </a>
          </Field>
        )}
        {job.client_email && (
          <Field name="email">
            <span className="truncate text-emerald-300">{job.client_email}</span>
          </Field>
        )}
        {address && (
          <Field name="addr">
            <a
              href={getDirectionsUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto relative min-w-0 truncate text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 hover:decoration-cyan-300"
            >
              {address}
            </a>
          </Field>
        )}
      </div>
    </div>
  );
}
