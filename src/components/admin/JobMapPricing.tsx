import { useMemo, useState } from 'react';
import { RotateCcw, Tag } from 'lucide-react';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import type { JobSite } from '../../utils/jobMap';
import {
  areaPricing,
  drivePricing,
  overallPricing,
  pricingAdvice,
  type PricingGroup,
  type PricingVerdict,
} from '../../utils/jobMapPricing';

interface Props {
  sites: JobSite[];
  /** The target in effect: the owner's own figure, or the automatic one. */
  targetRate: number;
  /** Average profit per hour over the last 3 months, or null with no recent paid work. */
  autoTargetRate: number | null;
  autoTargetJobCount: number;
  isCustomTarget: boolean;
  onTargetRateChange: (rate: number) => void;
  onResetTargetRate: () => void;
  ratePerMile: number;
  money: (amount: number) => string;
}

const VERDICTS: Record<PricingVerdict, { label: string; pill: string; accent: string }> = {
  raise: { label: 'Raise prices', pill: 'bg-amber-100 text-amber-900', accent: 'border-l-amber-400' },
  travel: { label: 'Add a travel charge', pill: 'bg-sky-100 text-sky-900', accent: 'border-l-sky-400' },
  hold: { label: 'Priced right', pill: 'bg-emerald-100 text-emerald-900', accent: 'border-l-emerald-500' },
  thin: { label: 'Not enough jobs yet', pill: 'bg-slate-100 text-slate-700', accent: 'border-l-slate-300' },
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

export default function JobMapPricing({
  sites,
  targetRate,
  autoTargetRate,
  autoTargetJobCount,
  isCustomTarget,
  onTargetRateChange,
  onResetTargetRate,
  ratePerMile,
  money,
}: Props) {
  const { privacyModeEnabled } = usePrivacyMode();
  // While focused the box shows exactly what was typed, so it can be cleared mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  // The automatic target is real earnings data, so privacy mode hides it too.
  const targetMasked = privacyModeEnabled && draft === null;

  const inputs = useMemo(() => ({ targetRate, ratePerMile }), [targetRate, ratePerMile]);
  const areas = useMemo(() => areaPricing(sites, inputs), [sites, inputs]);
  const bands = useMemo(() => drivePricing(sites, inputs), [sites, inputs]);
  const overall = useMemo(() => overallPricing(sites, inputs), [sites, inputs]);

  const perHour = (rate: number) => `${money(rate)}/hr`;
  const minutes = (group: PricingGroup) => Math.round((group.travelHours / group.visits) * 60);

  const targetSource = isCustomTarget
    ? 'Your own target'
    : autoTargetRate !== null
      ? `Your average over the last 3 months (${autoTargetJobCount} paid job${autoTargetJobCount === 1 ? '' : 's'})`
      : 'A starting point. No paid jobs in the last 3 months to average yet';

  return (
    <section aria-labelledby="job-map-pricing" className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2">
            <Tag className="h-5 w-5 text-teal-600" aria-hidden="true" />
          </div>
          <div>
            <h2 id="job-map-pricing" className="font-semibold text-slate-900">
              Pricing recommendations
            </h2>
            <p className="text-sm text-slate-600">
              What each area earns you per hour once the drive is counted, and what to charge to reach your target.
              Recalculated from your jobs every time this page loads or refreshes.
            </p>
          </div>
        </div>

        <div className="flex-none sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <label htmlFor="jobMapTargetRate" className="whitespace-nowrap text-sm font-medium text-slate-700">
              Target rate
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
              <input
                id="jobMapTargetRate"
                type={targetMasked ? 'text' : 'number'}
                min="1"
                step="5"
                inputMode="decimal"
                value={targetMasked ? '••••' : draft ?? String(targetRate)}
                onFocus={() => {
                  if (privacyModeEnabled) setDraft('');
                }}
                onChange={(event) => {
                  setDraft(event.target.value);
                  const parsed = Number(event.target.value);
                  if (event.target.value.trim() !== '' && Number.isFinite(parsed) && parsed > 0) onTargetRateChange(parsed);
                }}
                onBlur={() => setDraft(null)}
                className="w-24 rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm tabular-nums focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <span className="text-sm text-slate-500">/hr</span>
            {isCustomTarget && (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  onResetTargetRate();
                }}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Go back to the automatic target rate"
                title="Go back to the automatic target"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{targetSource}</p>
        </div>
      </div>

      {!overall ? (
        <p className="p-4 text-sm text-slate-500">
          Recommendations appear once there are completed jobs with a price, hours worked and a located address.
        </p>
      ) : (
        <>
          <p className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Across {overall.jobs} mapped jobs you earn <strong className="font-semibold text-slate-900">{perHour(overall.onSiteRate)}</strong> on
            site and <strong className="font-semibold text-slate-900">{perHour(overall.trueRate)}</strong> once{' '}
            {Math.round(overall.travelHours)} hours of driving and {money(overall.mileageCost)} of mileage are counted. The
            drive is priced at your target rate both ways, plus ${ratePerMile.toFixed(3).replace(/0$/, '')} a mile.
          </p>

          {/* A strong recent stretch sets a target the older jobs on the map were never
              priced for, which makes every area read as badly underpriced. Say so, and
              offer the long-run figure as a one-click alternative. */}
          {targetRate > overall.onSiteRate * 1.25 && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="min-w-0 flex-1">
                Your target of {perHour(targetRate)} is well above the {perHour(overall.onSiteRate)} you have averaged on
                site across every mapped job{isCustomTarget ? '' : ', because your last 3 months have paid much better'}.
                Read the increases below as how far your older prices sit from that rate, not as a jump to make in one go.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  onTargetRateChange(Math.round(overall.onSiteRate));
                }}
                className="flex-none rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-950 hover:bg-amber-100"
              >
                Use my all-time average instead
              </button>
            </div>
          )}

          <ul className="divide-y divide-slate-200">
            {areas.map((area) => {
              const style = VERDICTS[area.verdict];
              return (
                <li key={area.label} className={`border-l-4 p-4 ${style.accent}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-semibold text-slate-900">{area.label}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}>{style.label}</span>
                    <span className="text-xs text-slate-500">
                      {area.jobs} job{area.jobs === 1 ? '' : 's'} over {area.visits} visit{area.visits === 1 ? '' : 's'}, about{' '}
                      {minutes(area)} min of driving each
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{pricingAdvice(area, inputs, money)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    <Figure label="On site" value={perHour(area.onSiteRate)} />
                    <Figure label="After the drive" value={perHour(area.trueRate)} />
                    <Figure label="Travel charge per visit" value={money(area.travelCharge)} />
                    <Figure label="Smallest job worth it" value={money(area.minimumJob)} />
                  </dl>
                </li>
              );
            })}
          </ul>

          {bands.length > 0 && (
            <div className="border-t border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Travel charge by drive time</h3>
              <p className="text-sm text-slate-600">
                A rule of thumb for quoting somewhere new: look up the one-way drive and add this to the job.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="py-1.5 pr-4 font-semibold">One-way drive</th>
                      <th scope="col" className="px-4 py-1.5 text-right font-semibold">Visits</th>
                      <th scope="col" className="px-4 py-1.5 text-right font-semibold">Travel charge</th>
                      <th scope="col" className="py-1.5 pl-4 text-right font-semibold">Smallest job worth it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bands.map((band) => (
                      <tr key={band.label}>
                        <th scope="row" className="whitespace-nowrap py-2 pr-4 text-left font-medium text-slate-900">{band.label}</th>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">{band.visits}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-900">{money(band.travelCharge)}</td>
                        <td className="py-2 pl-4 text-right tabular-nums text-slate-900">{money(band.minimumJob)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
            Built from completed jobs that have a price, hours worked and a located address. Rates are profit after
            materials. Two jobs at one address on the same day count as one trip. "Smallest job worth it" is one hour on
            site plus the travel charge. Areas with fewer than 3 such jobs get no price advice.
          </p>
        </>
      )}
    </section>
  );
}
