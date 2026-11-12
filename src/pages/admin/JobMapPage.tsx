import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, MapPin } from 'lucide-react';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { getJobMapData, locateJobAddress, type JobMapData } from '../../services/jobMapService';
import {
  areaBreakdown,
  buildInsights,
  buildJobSites,
  driveBreakdown,
  summarizeSites,
  type GroupStat,
} from '../../utils/jobMap';

// Loaded on demand: the map brings in the state and county outline data.
const JobMap = lazy(() => import('../../components/admin/JobMap'));

/** Enough for a first visit; anything beyond it is picked up on the next one. */
const MAX_LOOKUPS_PER_VISIT = 40;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatJobDate(value: string | null): string {
  if (!value) return 'No date';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BreakdownTable({
  title,
  caption,
  firstColumn,
  rows,
  money,
  hideBars,
}: {
  title: string;
  caption: string;
  firstColumn: string;
  rows: GroupStat[];
  money: (amount: number) => string;
  hideBars: boolean;
}) {
  const top = Math.max(...rows.map((row) => row.avgPrice ?? 0), 0);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{caption}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Nothing to show yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">{firstColumn}</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Jobs</th>
                <th scope="col" className="px-4 py-2 font-semibold">Avg price</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-slate-900">{row.label}</th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{row.jobs}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-16 flex-none tabular-nums text-slate-900">
                        {row.avgPrice !== null ? money(row.avgPrice) : 'No price'}
                      </span>
                      {!hideBars && row.avgPrice !== null && top > 0 && (
                        <span className="h-2 min-w-12 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                          <span
                            className="block h-2 rounded-full bg-cyan-600"
                            style={{ width: `${Math.max(4, (row.avgPrice / top) * 100)}%` }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function JobMapPage() {
  const { maskFinancialValue, privacyModeEnabled } = usePrivacyMode();
  const [data, setData] = useState<JobMapData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- maskFinancialValue is a new function each render
  const money = useCallback((amount: number) => maskFinancialValue(dollars.format(amount)), [privacyModeEnabled]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await getJobMapData();
        if (cancelled) return;
        setData(loaded);
        setUpdatedAt(Date.now());

        // Addresses with no coordinates on file, or whose cached answer has
        // aged out, are looked up one at a time. Each costs a Mapbox call the
        // first time and is free after that.
        if (!loaded.hasOriginAddress) return;
        const { sites, unlocated } = buildJobSites(loaded.jobs, loaded.locations);
        const queue = [
          ...unlocated.filter((entry) => !loaded.notFound.has(entry.key)).map((entry) => entry.jobs[0].id),
          ...sites.filter((site) => loaded.stale.has(site.key)).map((site) => site.jobs[0].id),
        ].slice(0, MAX_LOOKUPS_PER_VISIT);
        if (queue.length === 0) return;

        setProgress({ done: 0, total: queue.length });
        try {
          for (let index = 0; index < queue.length; index += 1) {
            const status = await locateJobAddress(queue[index]);
            if (cancelled) return;
            if (status === 'origin_not_found' || status === 'no_address') {
              throw new Error('Your trip starting address could not be found. Check it under Mileage Settings.');
            }
            setProgress({ done: index + 1, total: queue.length });
          }
        } catch (failure) {
          if (!cancelled) setLookupError(failure instanceof Error ? failure.message : 'Address lookup failed');
        }

        const refreshed = await getJobMapData();
        if (cancelled) return;
        setData(refreshed);
        setUpdatedAt(Date.now());
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to load the job map');
      } finally {
        if (!cancelled) setProgress(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => (data ? buildJobSites(data.jobs, data.locations) : null), [data]);
  const summary = useMemo(() => summarizeSites(result?.sites ?? []), [result]);
  const areas = useMemo(() => areaBreakdown(result?.sites ?? []), [result]);
  const drives = useMemo(() => driveBreakdown(result?.sites ?? []), [result]);
  const insights = useMemo(() => buildInsights(result?.sites ?? [], money), [result, money]);

  const notMapped = result
    ? result.missingAddress.length + result.unlocated.reduce((sum, entry) => sum + entry.jobs.length, 0)
    : 0;
  const repeatShare = summary.revenue > 0 ? Math.round((summary.repeatRevenue / summary.revenue) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" aria-hidden="true" />
          Job Map
        </h1>
        <p className="text-slate-600 mt-1">
          Every completed job, placed by its street address. Addresses you have worked at more than once are ringed,
          and the heat map shows where the higher-priced jobs are.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-none" aria-hidden="true" />
          {error}
        </div>
      )}
      {lookupError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-none" aria-hidden="true" />
          Some addresses could not be looked up, so they are missing from the map. {lookupError}
        </div>
      )}
      {data && !data.hasOriginAddress && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-none" aria-hidden="true" />
          <span>
            New addresses cannot be located until a trip starting address is saved.{' '}
            <Link to="/admin/mileage-settings" className="font-medium underline">
              Add it under Mileage Settings
            </Link>
            .
          </span>
        </div>
      )}

      {!result ? (
        !error && <div className="mb-6 h-96 rounded-xl bg-[#050b17]" aria-label="Loading the job map" />
      ) : (
        <>
          <Suspense fallback={<div className="mb-6 h-96 rounded-xl bg-[#050b17]" aria-hidden="true" />}>
            <JobMap
              sites={result.sites}
              notMapped={notMapped}
              origin={data?.origin ?? null}
              updatedAt={updatedAt}
              status={progress ? `locating ${Math.min(progress.done + 1, progress.total)} of ${progress.total} addresses` : null}
              money={money}
            />
          </Suspense>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: 'Mapped revenue',
                value: money(summary.revenue),
                detail: `${summary.pricedJobs} priced job${summary.pricedJobs === 1 ? '' : 's'}`,
              },
              {
                label: 'Average job price',
                value: summary.avgPrice !== null ? money(summary.avgPrice) : 'No prices',
                detail: 'Free jobs left out',
              },
              {
                label: 'Repeat addresses',
                value: `${summary.repeatAddresses} of ${summary.addresses}`,
                detail: privacyModeEnabled ? `${summary.repeatJobs} jobs` : `${summary.repeatJobs} jobs, ${repeatShare}% of revenue`,
              },
              {
                label: 'Average drive',
                value: summary.avgDriveMinutes !== null ? `${Math.round(summary.avgDriveMinutes)} min` : 'Not known',
                detail:
                  summary.revenuePerDriveMinute !== null
                    ? `${money(summary.revenuePerDriveMinute)} earned per minute driven, one way`
                    : 'One way, from home base',
              },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{card.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{card.detail}</p>
              </div>
            ))}
          </div>

          {insights.length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">What the map says</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                {insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <BreakdownTable
              title="By area"
              caption="Best average price first. The area is the city saved on each job."
              firstColumn="Area"
              rows={areas}
              money={money}
              hideBars={privacyModeEnabled}
            />
            <BreakdownTable
              title="By drive time"
              caption="One-way drive from home base, to see whether going further pays."
              firstColumn="Drive"
              rows={drives}
              money={money}
              hideBars={privacyModeEnabled}
            />
          </div>

          {(result.missingAddress.length > 0 || result.unlocated.length > 0) && !progress && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-semibold text-amber-950">
                {notMapped} completed job{notMapped === 1 ? ' is' : 's are'} not on the map
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                Open a job and add or correct its address, and it appears here the next time you load this page.
              </p>
              <ul className="mt-3 divide-y divide-amber-200/70 text-sm">
                {result.missingAddress.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <span className="text-amber-950">
                      <span className="font-medium">{job.client_name}</span>
                      <span className="text-amber-800">
                        {' '}
                        &middot; {job.job_type || 'Job'} &middot; {formatJobDate(job.date_completed)}
                        {job.location_city ? ` · ${job.location_city}` : ''}
                      </span>
                    </span>
                    <Link to={`/admin/jobs?job=${job.id}`} className="font-medium text-amber-950 underline">
                      No address saved. Add it
                    </Link>
                  </li>
                ))}
                {result.unlocated.map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <span className="text-amber-950">
                      <span className="font-medium">{entry.address}</span>
                      <span className="text-amber-800">
                        {' '}
                        &middot; {entry.jobs.length} job{entry.jobs.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <Link to={`/admin/jobs?job=${entry.jobs[0].id}`} className="font-medium text-amber-950 underline">
                      Address not found. Check it
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
