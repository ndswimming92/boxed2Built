import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Loader2, MapPin, Sparkles, Tag } from 'lucide-react';
import type { FormInquiry } from '../../lib/supabase';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { getRecentAvgHourlyRate } from '../../services/analyticsCalculations';
import { getJobMapData, type JobMapData } from '../../services/jobMapService';
import {
  getInquiryPricing,
  locateInquiry,
  recommendInquiryPrice,
  type PriceRecommendation,
} from '../../services/inquiryPricingService';
import { buildJobSites, mapAddressKey } from '../../utils/jobMap';
import { areaPricing, drivePricing, overallPricing, pricingAdvice } from '../../utils/jobMapPricing';
import {
  buildInquiryQuote,
  driveFrom,
  inquiryHours,
  matchPricingGroup,
  parseMoney,
  type InquiryDrive,
} from '../../utils/inquiryPricing';

/** Matches the Job Map: used only when there is no recent paid work to average. */
const FALLBACK_TARGET_RATE = 50;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const LOCATE_PROBLEMS: Record<string, string> = {
  not_found: 'That address could not be found. Try adding the town and state.',
  origin_not_found: 'Your trip starting address could not be found. Check it under Mileage Settings.',
  no_address: 'Save your trip starting address under Mileage Settings to work out the drive.',
  no_route: 'No driving route to that address could be found.',
};

const CONFIDENCE: Record<PriceRecommendation['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      <dt className="text-sm">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * What to charge for this inquiry. Owner-only: it lives in the inquiry view and
 * is saved to a table nothing customer-facing reads, so it cannot reach a quote.
 */
export default function InquiryPriceCard({ inquiry }: { inquiry: FormInquiry }) {
  const { maskFinancialValue, privacyModeEnabled } = usePrivacyMode();
  const money = (amount: number) => maskFinancialValue(dollars.format(amount));
  /** Claude's sentences carry dollar amounts of their own, which privacy mode hides too. */
  const prose = (text: string) => (privacyModeEnabled ? text.replace(/\$[\d,.]+/g, '$••••') : text);

  const [mapData, setMapData] = useState<JobMapData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [located, setLocated] = useState<InquiryDrive | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<PriceRecommendation | null>(null);
  const [advisedAt, setAdvisedAt] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJobMapData(), getInquiryPricing(inquiry.id)])
      .then(([data, pricing]) => {
        if (cancelled) return;
        setMapData(data);
        setAddress(pricing.serviceAddress);
        setDraft(pricing.serviceAddress ?? '');
        setAdvice(pricing.recommendation);
        setAdvisedAt(pricing.recommendedAt);
      })
      .catch((failure) => {
        if (!cancelled) setLoadError(failure instanceof Error ? failure.message : 'Could not load pricing');
      });

    return () => {
      cancelled = true;
    };
  }, [inquiry.id]);

  const figures = useMemo(() => {
    if (!mapData) return null;

    const recent = getRecentAvgHourlyRate(mapData.jobs.filter((job) => !job.is_test));
    const autoTarget = recent && recent.rate > 0 ? Math.round(recent.rate) : null;
    const targetRate = autoTarget ?? FALLBACK_TARGET_RATE;
    const inputs = { targetRate, ratePerMile: mapData.ratePerMile };

    const { sites } = buildJobSites(mapData.jobs, mapData.locations);
    // A saved address the Job Map cache already knows needs no fresh lookup.
    const cached = address ? mapData.locations.get(mapAddressKey(address) ?? '') : undefined;
    const drive = located ?? (cached ? driveFrom(cached.durationSeconds, cached.distanceMeters) : null);

    const quote = buildInquiryQuote({
      hours: inquiryHours(inquiry),
      shownPrice: parseMoney(inquiry.estimated_price),
      couponAmount: Number(inquiry.coupon_discount_amount) || 0,
      targetRate,
      ratePerMile: mapData.ratePerMile,
      drive,
    });

    return {
      inputs,
      targetRate,
      targetJobs: autoTarget !== null ? recent!.jobCount : 0,
      drive,
      quote,
      group: matchPricingGroup(address, drive, areaPricing(sites, inputs), drivePricing(sites, inputs)),
      allTimeRate: overallPricing(sites, inputs)?.onSiteRate ?? null,
    };
  }, [mapData, address, located, inquiry]);

  const saveAddress = async () => {
    const next = draft.trim();
    if (next === (address ?? '')) return;
    setLocating(true);
    setLocateError(null);
    try {
      const result = await locateInquiry(inquiry.id, next);
      setAddress(result.address);
      setDraft(result.address ?? '');
      setLocated(result.status === 'ok' ? driveFrom(result.durationSeconds, result.distanceMeters) : null);
      if (result.address && result.status !== 'ok') {
        setLocateError(LOCATE_PROBLEMS[result.status] ?? 'The drive to that address could not be worked out.');
      }
    } catch (failure) {
      setLocateError(failure instanceof Error ? failure.message : 'Could not save the address');
    } finally {
      setLocating(false);
    }
  };

  const askClaude = async () => {
    if (!figures) return;
    const { quote, drive, group, targetRate, allTimeRate, inputs } = figures;
    setAsking(true);
    setAskError(null);
    try {
      const result = await recommendInquiryPrice(inquiry.id, {
        targetRate,
        allTimeRate,
        hours: quote?.hours ?? null,
        labor: quote?.labor ?? null,
        travel: quote?.travel ?? null,
        recommended: quote?.recommended ?? null,
        driveMinutes: drive ? Math.round(drive.seconds / 60) : null,
        area: group?.label ?? null,
        // Unmasked on purpose: this goes to Claude, not to the screen.
        areaAdvice: group ? pricingAdvice(group, inputs, (amount) => dollars.format(amount)) : null,
      });
      setAdvice(result.recommendation);
      setAdvisedAt(result.recommendedAt);
    } catch (failure) {
      setAskError(failure instanceof Error ? failure.message : 'Claude could not be reached');
    } finally {
      setAsking(false);
    }
  };

  const quote = figures?.quote ?? null;
  const drive = figures?.drive ?? null;
  const group = figures?.group ?? null;
  const headline = advice?.price ?? quote?.recommended ?? null;

  return (
    <section
      aria-labelledby="inquiry-price-card"
      data-testid="inquiry-price-card"
      className="overflow-hidden rounded-lg border border-teal-200 bg-white"
    >
      <div className="flex items-start justify-between gap-3 border-b border-teal-100 bg-teal-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <h3 id="inquiry-price-card" className="text-sm font-semibold text-slate-800">
            What to charge
          </h3>
        </div>
        <p className="flex items-center gap-1 text-xs font-medium text-teal-800">
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          Only you see this
        </p>
      </div>

      <div className="space-y-4 p-4">
        {loadError && <p className="text-sm text-red-700">{loadError}</p>}
        {!mapData && !loadError && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Working out a price from your jobs…
          </p>
        )}

        {mapData && (
          <>
            {headline !== null ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {advice ? "Claude's recommendation" : 'Recommended price'}
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-slate-900" data-testid="inquiry-price-recommended">
                    {money(headline)}
                  </p>
                  {advice && (
                    <p className="text-xs text-slate-600">
                      Range {money(advice.low)} to {money(advice.high)} · {CONFIDENCE[advice.confidence]}
                    </p>
                  )}
                </div>
                {quote?.gap != null && quote.shownBeforeCoupon !== null && (
                  <p className="max-w-[16rem] text-right text-sm text-slate-700">
                    The form showed the customer{' '}
                    <span className="font-semibold">{money(quote.shownBeforeCoupon)}</span>
                    {inquiry.coupon_code ? ' before their coupon' : ''}.{' '}
                    {Math.abs(headline - quote.shownBeforeCoupon) < 5 ? (
                      'That matches.'
                    ) : (
                      <span className={headline > quote.shownBeforeCoupon ? 'font-semibold text-amber-800' : 'font-semibold text-emerald-700'}>
                        {money(Math.abs(headline - quote.shownBeforeCoupon))}{' '}
                        {headline > quote.shownBeforeCoupon ? 'under this price' : 'over this price'}.
                      </span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                This inquiry has no time estimate to price from. Ask Claude below, or price it by hand.
              </p>
            )}

            {quote && figures && (
              <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
                <Row
                  label={`On site: ${quote.hours} hr at ${money(figures.targetRate)}/hr`}
                  value={money(quote.labor)}
                />
                <Row
                  label={
                    drive
                      ? `Travel: ${Math.round(drive.seconds / 60)} min each way, plus mileage`
                      : 'Travel: add the address below'
                  }
                  value={quote.travel !== null ? money(quote.travel) : 'Not counted'}
                />
                <div className="border-t border-slate-200 pt-1.5">
                  <Row label="Formula price" value={money(quote.recommended)} strong />
                </div>
                <p className="pt-1 text-xs text-slate-500">
                  {figures.targetJobs > 0
                    ? `${money(figures.targetRate)}/hr is your average over the last 3 months (${figures.targetJobs} paid job${figures.targetJobs === 1 ? '' : 's'}), the same target as the Job Map.`
                    : `${money(figures.targetRate)}/hr is a starting point. No paid jobs in the last 3 months to average yet.`}{' '}
                  Smallest job worth this trip: {money(quote.minimumJob)}.
                </p>
              </dl>
            )}

            <div>
              <label htmlFor="inquiryWorkAddress" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Where is the work?
              </label>
              <div className="flex gap-2">
                <input
                  id="inquiryWorkAddress"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveAddress();
                  }}
                  placeholder="Street address, or just the town"
                  maxLength={300}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => void saveAddress()}
                  disabled={locating || draft.trim() === (address ?? '')}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
                >
                  {locating ? 'Finding…' : 'Save'}
                </button>
              </div>
              {locateError && <p className="mt-1 text-xs text-red-700">{locateError}</p>}
              {group && figures && (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{group.label}:</span>{' '}
                  {pricingAdvice(group, figures.inputs, money)}
                </p>
              )}
            </div>

            {advice && (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{prose(advice.reasoning)}</p>
                {advice.factors.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {advice.factors.map((factor) => (
                      <li key={factor}>{prose(factor)}</li>
                    ))}
                  </ul>
                )}
                {advice.questions_to_ask.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Worth asking first</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {advice.questions_to_ask.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {quote && advice.formula_price !== null && advice.formula_price !== quote.recommended && (
                  <p className="mt-3 text-xs font-medium text-amber-800">
                    The formula price has changed since Claude looked at this. Ask again to bring it up to date.
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Claude compared this with {advice.jobs_considered} finished job{advice.jobs_considered === 1 ? '' : 's'}
                  {advisedAt ? ` on ${new Date(advisedAt).toLocaleDateString()}` : ''}. It is a suggestion; the price is yours to set.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void askClaude()}
                disabled={asking}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {asking ? 'Claude is reading your jobs…' : advice ? 'Ask Claude again' : quote ? 'Ask Claude to check this price' : 'Ask Claude for a price'}
              </button>
              <p className="text-xs text-slate-500">
                Reads the customer&apos;s notes and your past jobs. Costs a few cents each time.
              </p>
            </div>
            {askError && <p className="text-sm text-red-700">{askError}</p>}
          </>
        )}
      </div>
    </section>
  );
}
