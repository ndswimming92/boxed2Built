import { DRIVE_BANDS, jobPrice, type JobSite } from './jobMap.ts';

/**
 * Pricing recommendations for the Job Map: what each area really earns per hour
 * once the drive is counted, and what to charge to reach the target rate.
 * Pure functions, recomputed from whatever jobs are loaded.
 */

/** Within this share of the target, an area counts as on target. */
const TOLERANCE = 0.05;
/** Fewer priced jobs than this is an anecdote, not an area's going rate. */
export const MIN_JOBS_FOR_ADVICE = 3;

export interface PricingInputs {
  /** Dollars of profit per hour to aim for, applied to on-site and driving time alike. */
  targetRate: number;
  /** Vehicle cost per mile, from Mileage Settings. */
  ratePerMile: number;
}

export type PricingVerdict = 'thin' | 'hold' | 'travel' | 'raise';

export interface PricingGroup {
  label: string;
  /** Priced jobs with hours and a drive time: the ones the figures are built from. */
  jobs: number;
  /** Trips made. Two jobs at one address on the same day are one trip. */
  visits: number;
  hours: number;
  revenue: number;
  materials: number;
  /** Round-trip driving hours over all visits. */
  travelHours: number;
  /** Round-trip miles over all visits, at the mileage rate. */
  mileageCost: number;
  /** Profit per hour on site, the same measure as Pricing Intelligence. */
  onSiteRate: number;
  /** Profit per hour once driving time and mileage are counted. */
  trueRate: number;
  /** What one visit's travel costs at the target rate, rounded to $5. */
  travelCharge: number;
  /** Smallest job worth the trip: one hour on site plus the travel charge. */
  minimumJob: number;
  /** How far base prices sit below the target on-site rate, as a share of revenue. 0 when at or above. */
  baseRaisePct: number;
  /** Average dollars that raise adds to a job. */
  baseRaisePerJob: number;
  /** How far final prices ran over (+) or under (-) their quotes. Null without enough quoted jobs. */
  quoteDriftPct: number | null;
  verdict: PricingVerdict;
}

interface Tally {
  jobs: number;
  visits: number;
  hours: number;
  revenue: number;
  materials: number;
  travelHours: number;
  mileageCost: number;
  quoted: number;
  quotedFinal: number;
  quotedJobs: number;
}

const roundTo5 = (amount: number) => Math.max(5, Math.round(amount / 5) * 5);

function finish(label: string, tally: Tally, { targetRate }: PricingInputs): PricingGroup {
  const net = tally.revenue - tally.materials;
  const onSiteRate = net / tally.hours;
  const trueRate = (net - tally.mileageCost) / (tally.hours + tally.travelHours);

  const travelPerVisit = (targetRate * tally.travelHours + tally.mileageCost) / tally.visits;
  const travelCharge = roundTo5(travelPerVisit);

  const baseShortfall = Math.max(0, targetRate * tally.hours + tally.materials - tally.revenue);
  const baseRaisePct = tally.revenue > 0 ? baseShortfall / tally.revenue : 0;

  let verdict: PricingVerdict;
  if (tally.jobs < MIN_JOBS_FOR_ADVICE) verdict = 'thin';
  else if (trueRate >= targetRate * (1 - TOLERANCE)) verdict = 'hold';
  else if (onSiteRate >= targetRate * (1 - TOLERANCE)) verdict = 'travel';
  else verdict = 'raise';

  return {
    label,
    jobs: tally.jobs,
    visits: tally.visits,
    hours: tally.hours,
    revenue: tally.revenue,
    materials: tally.materials,
    travelHours: tally.travelHours,
    mileageCost: tally.mileageCost,
    onSiteRate,
    trueRate,
    travelCharge,
    minimumJob: roundTo5(targetRate + travelPerVisit),
    baseRaisePct,
    baseRaisePerJob: baseShortfall / tally.jobs,
    quoteDriftPct:
      tally.quotedJobs >= MIN_JOBS_FOR_ADVICE && tally.quoted > 0 ? (tally.quotedFinal - tally.quoted) / tally.quoted : null,
    verdict,
  };
}

/**
 * Tallies sites into groups. Only jobs with a price, hours worked and a known
 * drive time count, because without all three there is no hourly rate to speak of.
 */
function pricingBy(sites: JobSite[], labelOf: (site: JobSite) => string | null, inputs: PricingInputs): PricingGroup[] {
  const tallies = new Map<string, Tally>();

  for (const site of sites) {
    const label = labelOf(site);
    if (label === null || site.driveSeconds == null) continue;

    const usable = site.jobs.filter((job) => jobPrice(job) !== null && Number(job.hours_worked) > 0);
    if (usable.length === 0) continue;

    const tally =
      tallies.get(label) ??
      { jobs: 0, visits: 0, hours: 0, revenue: 0, materials: 0, travelHours: 0, mileageCost: 0, quoted: 0, quotedFinal: 0, quotedJobs: 0 };
    tallies.set(label, tally);

    const visits = new Set(usable.map((job) => job.date_completed ?? job.id)).size;
    tally.visits += visits;
    tally.travelHours += (visits * 2 * site.driveSeconds) / 3600;
    tally.mileageCost += visits * 2 * (site.distanceMiles ?? 0) * inputs.ratePerMile;

    for (const job of usable) {
      const price = jobPrice(job)!;
      tally.jobs += 1;
      tally.hours += Number(job.hours_worked);
      tally.revenue += price;
      tally.materials += Number(job.materials_cost) || 0;

      const quote = Number(job.quoted_price);
      const final = Number(job.final_price);
      if (quote > 0 && final > 0) {
        tally.quoted += quote;
        tally.quotedFinal += final;
        tally.quotedJobs += 1;
      }
    }
  }

  return [...tallies.entries()].map(([label, tally]) => finish(label, tally, inputs));
}

const VERDICT_ORDER: Record<PricingVerdict, number> = { raise: 0, travel: 1, hold: 2, thin: 3 };

/** One recommendation per town, the ones needing the biggest change first. */
export function areaPricing(sites: JobSite[], inputs: PricingInputs): PricingGroup[] {
  return pricingBy(sites, (site) => site.city, inputs).sort(
    (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || a.trueRate - b.trueRate,
  );
}

/** A travel charge for each drive-time band that has jobs, nearest first. */
export function drivePricing(sites: JobSite[], inputs: PricingInputs): PricingGroup[] {
  const order: string[] = DRIVE_BANDS.map((band) => band.label);
  return pricingBy(
    sites,
    (site) => (site.driveSeconds == null ? null : DRIVE_BANDS.find((band) => site.driveSeconds! / 60 < band.maxMinutes)!.label),
    inputs,
  ).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

/** Every mapped job as one group, for the headline figures. Null when nothing qualifies. */
export function overallPricing(sites: JobSite[], inputs: PricingInputs): PricingGroup | null {
  return pricingBy(sites, () => 'All areas', inputs)[0] ?? null;
}

/** The recommendation for one group, as a sentence. Money goes through `money` so privacy mode can mask it. */
export function pricingAdvice(group: PricingGroup, inputs: PricingInputs, money: (amount: number) => string): string {
  const quoteNote =
    group.quoteDriftPct !== null && group.quoteDriftPct >= TOLERANCE
      ? ` Final prices here ran ${Math.round(group.quoteDriftPct * 100)}% over your quotes, so quote higher up front.`
      : '';

  switch (group.verdict) {
    case 'thin':
      return (
        `Only ${group.jobs} priced job${group.jobs === 1 ? '' : 's'} here so far, too few to judge your prices. ` +
        `The drive alone is worth about ${money(group.travelCharge)} a visit.`
      );
    case 'hold':
      return (
        (group.trueRate >= inputs.targetRate * 1.15
          ? 'Well above your target even after the drive. Keep prices where they are; you have room to sharpen a quote to win work here.'
          : 'On target once the drive is counted. Keep prices where they are.') + quoteNote
      );
    case 'travel':
      return (
        `Your prices are fine on site; the drive is what pulls this area under target. ` +
        `Add about ${money(group.travelCharge)} a visit for travel.` +
        quoteNote
      );
    case 'raise':
      return (
        `Base prices are low here. Raise them about ${Math.max(1, Math.round(group.baseRaisePct * 100))}% ` +
        `(around ${money(roundTo5(group.baseRaisePerJob))} on an average job), ` +
        `and add about ${money(group.travelCharge)} a visit for travel.` +
        quoteNote
      );
  }
}
