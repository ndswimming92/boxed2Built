import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Clock, Mail, MapPin, Phone, User } from 'lucide-react';
import type { Job } from '../../lib/supabase';
import { formatDate } from '../../utils/jobCalculations';
import { getDirectionsUrl, resolveWorkAddress } from '../../utils/jobAddress';
import { formatTimeOfDay } from '../../utils/nextJob';

interface NextJobBannerProps {
  job: Job;
}

export default function NextJobBanner({ job }: NextJobBannerProps) {
  const start = formatTimeOfDay(job.scheduled_start_time);
  const end = formatTimeOfDay(job.scheduled_end_time);
  const time = start ? (end ? `${start} – ${end}` : start) : 'Time not set';
  const address = resolveWorkAddress(job);
  const phoneHref = job.client_phone ? `tel:${job.client_phone.replace(/[^\d+]/g, '')}` : null;

  return (
    // The whole banner opens the job via the overlay link; the phone and address are real links
    // sitting above it, since anchors can't be nested.
    <div className="relative mb-6 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 transition-colors hover:bg-emerald-100 lg:flex-row lg:items-center lg:gap-6">
      <Link
        to={`/admin/jobs?job=${job.id}`}
        aria-label={`View job for ${job.client_name}`}
        className="absolute inset-0 rounded-xl"
      />
      <div className="pointer-events-none relative flex items-center gap-2 text-emerald-800">
        <CalendarClock className="h-5 w-5 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">Next job</span>
      </div>

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          {formatDate(job.date_scheduled)} · {time}
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          <User className="h-3.5 w-3.5 text-slate-500" />
          {job.client_name}
        </span>
        {job.client_phone && phoneHref && (
          <a
            href={phoneHref}
            className="pointer-events-auto relative flex items-center gap-1.5 font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {job.client_phone}
          </a>
        )}
        {job.client_email && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
            <span className="truncate">{job.client_email}</span>
          </span>
        )}
        {address && (
          <a
            href={getDirectionsUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto relative flex min-w-0 items-center gap-1.5 font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{address}</span>
          </a>
        )}
      </div>

      <span className="pointer-events-none relative flex items-center gap-1 text-sm font-medium text-emerald-700">
        View job
        <ArrowRight className="h-4 w-4" />
      </span>
    </div>
  );
}
