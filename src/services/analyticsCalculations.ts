import type { Job } from '../lib/supabase';

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalNetProfit: number;
  /** Net profit divided by PAID hours only. */
  profitPerHour: number;
  /** Revenue divided by PAID hours only — what an hour of billable work earns. */
  avgHourlyRate: number;
  /** Revenue divided by ALL hours worked, free jobs included. */
  blendedHourlyRate: number;
  jobsThisMonth: number;
  revenueThisMonth: number;
  repeatClientPercent: number;
  avgHoursPerJob: number;
  avgRevenuePerJob: number;
  totalJobs: number;
  paidJobs: number;
  freeJobs: number;
  totalHours: number;
  paidHours: number;
  freeHours: number;
  profitMarginPercent: number;
  revenuePerHourRatio: number;
  quotedVsFinalRatio: number;
}

export interface JobTypeCount {
  type: string;
  count: number;
}

export interface LocationRevenue {
  city: string;
  revenue: number;
  netProfit: number;
  count: number;
  [key: string]: string | number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  netProfit: number;
  jobs: number;
}

export interface ReferralSourceData {
  source: string;
  revenue: number;
  count: number;
}

export interface ClientTypeData {
  type: 'Repeat' | 'New';
  count: number;
  percent: number;
  [key: string]: string | number;
}

export interface ConversionMetrics {
  totalOpportunities: number;
  quotedJobs: number;
  acceptedJobs: number;
  scheduledJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  lostJobs: number;
  cancelledJobs: number;
  quoteToCompleteRate: number;
  winRate: number;
  lossRate: number;
  cancellationRate: number;
  activePipelineValue: number;
  lostOpportunityValue: number;
  avgDaysToComplete: number;
}

export interface ClientTimeSavedMetric {
  rawHours: number;
  label: string;
  title: string;
  subtitle: string;
}

export interface LostDealBreakdown {
  category: string;
  count: number;
  totalValue: number;
  percentage: number;
}

export interface JobTypeConversion {
  jobType: string;
  totalQuoted: number;
  completed: number;
  lost: number;
  cancelled: number;
  winRate: number;
  avgQuoteValue: number;
  totalRevenue: number;
}

export type TimePeriod = 'current_month' | 'last_3_months' | 'last_6_months' | 'current_year' | 'all_time';

export const CLIENT_TIME_SAVED_TITLE = 'Hours Given Back to Customers';
export const CLIENT_TIME_SAVED_SUBTITLE = 'Calculated as the direct sum of completed job hours worked.';

export function calculateClientTimeSaved(hoursWorkedValues: Array<number | null | undefined>): ClientTimeSavedMetric {
  const rawHours = hoursWorkedValues.reduce<number>((sum, hoursWorked) => sum + (Number(hoursWorked) || 0), 0);

  return {
    rawHours,
    label: `${rawHours.toFixed(1)} hrs`,
    title: CLIENT_TIME_SAVED_TITLE,
    subtitle: CLIENT_TIME_SAVED_SUBTITLE,
  };
}

function calculateNetProfit(finalPrice: number | null, materialsCost: number | null): number {
  if (finalPrice === null) return 0;
  const materials = materialsCost || 0;
  return finalPrice - materials;
}

/**
 * Parses a job date into the LOCAL calendar day it represents.
 *
 * `date_completed`, `date_quoted` and `date_scheduled` are Postgres `date`
 * columns, so Supabase hands them back as bare 'YYYY-MM-DD' strings. Passing
 * those straight to `new Date()` parses them as UTC midnight, which in any
 * negative-offset timezone lands on the PREVIOUS local day — a job completed
 * Jan 1 reads as Dec 31, falls outside a "This Year" range, and buckets into
 * the wrong month. Building the Date from the parts keeps it on the intended
 * day regardless of where the browser is.
 */
export function parseJobDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A job counts as paid work when a final price was actually recorded and it
 * was not comped. Free jobs are real work — they keep their hours and their
 * place in job counts — but they carry no revenue, so their hours must stay
 * out of any $/hr denominator. Mixing them in silently understates the rate.
 */
export function isPaidJob(job: Job): boolean {
  return job.final_price !== null && job.final_price !== undefined && job.is_free !== true;
}

function filterJobsByPeriod(jobs: Job[], period: TimePeriod): Job[] {
  if (period === 'all_time') return jobs;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return jobs.filter(job => {
    const jobDate = parseJobDate(job.date_completed);
    if (!jobDate) return false;
    const jobYear = jobDate.getFullYear();
    const jobMonth = jobDate.getMonth();

    switch (period) {
      case 'current_month':
        return jobYear === currentYear && jobMonth === currentMonth;

      case 'last_3_months': {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return jobDate >= threeMonthsAgo && jobDate <= now;
      }

      case 'last_6_months': {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return jobDate >= sixMonthsAgo && jobDate <= now;
      }

      case 'current_year':
        return jobYear === currentYear;

      default:
        return true;
    }
  });
}

export function calculateMetrics(jobs: Job[], period: TimePeriod): AnalyticsMetrics {
  const filteredJobs = filterJobsByPeriod(jobs, period);
  const completedJobs = filteredJobs.filter(job => job.date_completed);

  const paidJobs = completedJobs.filter(isPaidJob);
  const freeJobs = completedJobs.filter(job => !isPaidJob(job));

  const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.final_price || 0), 0);
  const totalNetProfit = completedJobs.reduce(
    (sum, job) => sum + calculateNetProfit(job.final_price, job.materials_cost),
    0
  );

  const totalHours = completedJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
  const paidHours = paidJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
  const freeHours = totalHours - paidHours;

  // Rates divide by PAID hours: hours given away for free earn no revenue, so
  // counting them in the denominator makes every rate look worse than the work
  // actually priced out. blendedHourlyRate keeps the all-hours view available.
  const profitPerHour = paidHours > 0 ? totalNetProfit / paidHours : 0;
  const avgHourlyRate = paidHours > 0 ? totalRevenue / paidHours : 0;
  const blendedHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const jobsThisMonthList = completedJobs.filter(job => {
    const jobDate = parseJobDate(job.date_completed);
    if (!jobDate) return false;
    return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
  });

  const jobsThisMonth = jobsThisMonthList.length;
  const revenueThisMonth = jobsThisMonthList.reduce((sum, job) => sum + (job.final_price || 0), 0);

  const repeatClients = completedJobs.filter(job => job.repeat_client).length;
  const repeatClientPercent = completedJobs.length > 0 ? (repeatClients / completedJobs.length) * 100 : 0;

  // Only jobs that actually logged hours belong in an hours-per-job average;
  // jobs left blank would otherwise pull the average toward zero.
  const jobsWithHours = completedJobs.filter(job => (job.hours_worked || 0) > 0);
  const avgHoursPerJob = jobsWithHours.length > 0 ? totalHours / jobsWithHours.length : 0;
  const avgRevenuePerJob = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  const profitMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
  const revenuePerHourRatio = avgHourlyRate;

  // A zero or missing quote has no ratio to contribute. The old guard swapped
  // in `|| 1`, turning a $30 job quoted at $0 into a 3000% variance.
  const jobsWithQuotes = completedJobs.filter(
    job => (job.quoted_price || 0) > 0 && job.final_price !== null
  );
  const quotedVsFinalRatio = jobsWithQuotes.length > 0
    ? jobsWithQuotes.reduce((sum, job) => sum + ((job.final_price || 0) / job.quoted_price!), 0) / jobsWithQuotes.length
    : 1;

  return {
    totalRevenue,
    totalNetProfit,
    profitPerHour,
    avgHourlyRate,
    blendedHourlyRate,
    jobsThisMonth,
    revenueThisMonth,
    repeatClientPercent,
    avgHoursPerJob,
    avgRevenuePerJob,
    totalJobs: completedJobs.length,
    paidJobs: paidJobs.length,
    freeJobs: freeJobs.length,
    totalHours,
    paidHours,
    freeHours,
    profitMarginPercent,
    revenuePerHourRatio,
    quotedVsFinalRatio,
  };
}

export function getJobsByType(jobs: Job[], period: TimePeriod): JobTypeCount[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(job => job.date_completed);
  const typeMap = new Map<string, number>();

  filteredJobs.forEach(job => {
    const type = job.job_type || 'Uncategorized';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });

  return Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function getLocationRevenue(jobs: Job[], period: TimePeriod): LocationRevenue[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(job => job.date_completed);
  const locationMap = new Map<string, { revenue: number; netProfit: number; count: number }>();

  filteredJobs.forEach(job => {
    const city = job.location_city || 'Unknown';
    const existing = locationMap.get(city) || { revenue: 0, netProfit: 0, count: 0 };

    locationMap.set(city, {
      revenue: existing.revenue + (job.final_price || 0),
      netProfit: existing.netProfit + calculateNetProfit(job.final_price, job.materials_cost),
      count: existing.count + 1,
    });
  });

  return Array.from(locationMap.entries())
    .map(([city, data]) => ({ city, ...data }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

export function getMonthlyData(jobs: Job[], period: TimePeriod): MonthlyData[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(job => job.date_completed);
  const monthMap = new Map<string, { revenue: number; netProfit: number; jobs: number }>();

  filteredJobs.forEach(job => {
    const date = parseJobDate(job.date_completed);
    if (!date) return;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const existing = monthMap.get(monthKey) || { revenue: 0, netProfit: 0, jobs: 0 };

    monthMap.set(monthKey, {
      revenue: existing.revenue + (job.final_price || 0),
      netProfit: existing.netProfit + calculateNetProfit(job.final_price, job.materials_cost),
      jobs: existing.jobs + 1,
    });
  });

  const sortedEntries = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sortedEntries.map(([key, data]) => {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    return {
      month: monthLabel,
      ...data,
    };
  });
}

export function getReferralSourceData(jobs: Job[], period: TimePeriod): ReferralSourceData[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(job => job.date_completed);
  const sourceMap = new Map<string, { revenue: number; count: number }>();

  filteredJobs.forEach(job => {
    const source = job.referral_source || 'Unknown';
    const existing = sourceMap.get(source) || { revenue: 0, count: 0 };

    sourceMap.set(source, {
      revenue: existing.revenue + (job.final_price || 0),
      count: existing.count + 1,
    });
  });

  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function getClientTypeData(jobs: Job[], period: TimePeriod): ClientTypeData[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(job => job.date_completed);

  const repeatCount = filteredJobs.filter(job => job.repeat_client).length;
  const newCount = filteredJobs.length - repeatCount;
  const total = filteredJobs.length;

  return [
    {
      type: 'Repeat',
      count: repeatCount,
      percent: total > 0 ? (repeatCount / total) * 100 : 0,
    },
    {
      type: 'New',
      count: newCount,
      percent: total > 0 ? (newCount / total) * 100 : 0,
    },
  ];
}

export function getHealthStatus(metrics: AnalyticsMetrics): { status: string; color: string } {
  let score = 0;

  if (metrics.profitMarginPercent >= 70) score += 25;
  else if (metrics.profitMarginPercent >= 60) score += 20;
  else if (metrics.profitMarginPercent >= 50) score += 15;
  else if (metrics.profitMarginPercent >= 40) score += 10;

  if (metrics.avgHourlyRate >= 50) score += 25;
  else if (metrics.avgHourlyRate >= 40) score += 20;
  else if (metrics.avgHourlyRate >= 30) score += 15;
  else if (metrics.avgHourlyRate >= 20) score += 10;

  if (metrics.repeatClientPercent >= 40) score += 25;
  else if (metrics.repeatClientPercent >= 30) score += 20;
  else if (metrics.repeatClientPercent >= 20) score += 15;
  else if (metrics.repeatClientPercent >= 10) score += 10;

  if (metrics.totalJobs >= 20) score += 25;
  else if (metrics.totalJobs >= 15) score += 20;
  else if (metrics.totalJobs >= 10) score += 15;
  else if (metrics.totalJobs >= 5) score += 10;

  if (score >= 85) return { status: 'Excellent', color: 'text-emerald-600' };
  if (score >= 70) return { status: 'Good', color: 'text-blue-600' };
  if (score >= 50) return { status: 'Moderate', color: 'text-amber-600' };
  if (score >= 30) return { status: 'Fair', color: 'text-orange-600' };
  return { status: 'Needs Attention', color: 'text-red-600' };
}

export interface JobTypePerformance {
  type: string;
  count: number;
  totalRevenue: number;
  totalNetProfit: number;
  avgRevenue: number;
  avgNetProfit: number;
  avgHours: number;
  avgHourlyRate: number;
  profitMargin: number;
  totalHours: number;
  paidHours: number;
  freeCount: number;
  minPrice: number;
  maxPrice: number;
  avgMaterialsCost: number;
  materialsPercent: number;
  avgQuoteVariance: number | null;
  quoteAccuracyCount: number;
}

export interface QuoteVarianceJob {
  id: string;
  client_name: string;
  job_type: string;
  date_completed: string | null;
  quoted_price: number;
  final_price: number;
  dollarDifference: number;
  percentDifference: number;
}

export interface QuoteAccuracyMonthly {
  month: string;
  avgVariancePercent: number;
  jobCount: number;
  totalQuoted: number;
  totalFinal: number;
}

export interface ProfitabilityJob {
  id: string;
  client_name: string;
  job_type: string;
  date_completed: string | null;
  final_price: number;
  materials_cost: number;
  hours_worked: number;
  netProfit: number;
  profitMargin: number;
  hourlyRate: number;
}

export interface PricingRecommendation {
  jobType: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  recommendedMin: number;
  /** The price that actually hits targetHourlyRate. Display this, not a range midpoint. */
  recommendedTarget: number;
  recommendedMax: number;
  currentAvgHourlyRate: number;
  targetHourlyRate: number;
  priceAdjustmentNeeded: number;
  avgHours: number;
  sampleSize: number;
}

export interface ProfitMarginDistribution {
  range: string;
  count: number;
  percent: number;
  avgRevenue: number;
}

export interface MaterialsCostAnalysis {
  jobType: string;
  avgMaterialsPercent: number;
  avgMaterialsCost: number;
  count: number;
  totalRevenue: number;
  suggestion: string;
}

export function getJobTypePerformance(jobs: Job[], period: TimePeriod): JobTypePerformance[] {
  // Explicit null checks, not truthiness: `job.final_price && job.hours_worked`
  // silently dropped legitimately-$0 jobs and any job logged at 0 hours.
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(
    job => job.date_completed && job.final_price !== null && (job.hours_worked || 0) > 0
  );

  const typeMap = new Map<string, Job[]>();

  filteredJobs.forEach(job => {
    const type = job.job_type || 'Uncategorized';
    if (!typeMap.has(type)) {
      typeMap.set(type, []);
    }
    typeMap.get(type)!.push(job);
  });

  return Array.from(typeMap.entries())
    .map(([type, typeJobs]) => {
      const totalRevenue = typeJobs.reduce((sum, job) => sum + (job.final_price || 0), 0);
      const totalNetProfit = typeJobs.reduce(
        (sum, job) => sum + calculateNetProfit(job.final_price, job.materials_cost),
        0
      );
      const totalHours = typeJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
      const paidTypeJobs = typeJobs.filter(isPaidJob);
      const paidHours = paidTypeJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
      const totalMaterialsCost = typeJobs.reduce((sum, job) => sum + (job.materials_cost || 0), 0);
      const count = typeJobs.length;

      const prices = paidTypeJobs.map(job => job.final_price || 0).filter(price => price > 0);

      const jobsWithQuotes = typeJobs.filter(j => (j.quoted_price || 0) > 0 && j.final_price !== null);
      const quoteAccuracyCount = jobsWithQuotes.length;
      const avgQuoteVariance = quoteAccuracyCount > 0
        ? jobsWithQuotes.reduce((sum, j) => sum + (((j.final_price! - j.quoted_price!) / j.quoted_price!) * 100), 0) / quoteAccuracyCount
        : null;

      return {
        type,
        count,
        totalRevenue,
        totalNetProfit,
        avgRevenue: totalRevenue / count,
        avgNetProfit: totalNetProfit / count,
        avgHours: totalHours / count,
        avgHourlyRate: paidHours > 0 ? totalNetProfit / paidHours : 0,
        profitMargin: totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0,
        totalHours,
        paidHours,
        freeCount: count - paidTypeJobs.length,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        avgMaterialsCost: totalMaterialsCost / count,
        materialsPercent: totalRevenue > 0 ? (totalMaterialsCost / totalRevenue) * 100 : 0,
        avgQuoteVariance,
        quoteAccuracyCount,
      };
    })
    .sort((a, b) => b.totalNetProfit - a.totalNetProfit);
}

export function getProfitabilityLeaderboard(
  jobs: Job[],
  period: TimePeriod,
  limit: number = 10
): { topJobs: ProfitabilityJob[]; bottomJobs: ProfitabilityJob[] } {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(
    job => job.date_completed && job.final_price !== null && (job.hours_worked || 0) > 0
  );

  const profitabilityJobs: ProfitabilityJob[] = filteredJobs.map(job => {
    const netProfit = calculateNetProfit(job.final_price, job.materials_cost);
    const profitMargin = job.final_price ? (netProfit / job.final_price) * 100 : 0;
    const hourlyRate = job.hours_worked ? netProfit / job.hours_worked : 0;

    return {
      id: job.id,
      client_name: job.client_name,
      job_type: job.job_type || 'Uncategorized',
      date_completed: job.date_completed,
      final_price: job.final_price || 0,
      materials_cost: job.materials_cost || 0,
      hours_worked: job.hours_worked || 0,
      netProfit,
      profitMargin,
      hourlyRate,
    };
  });

  const sortedByProfit = [...profitabilityJobs].sort((a, b) => b.netProfit - a.netProfit);

  // With fewer than 2x limit jobs the two slices would overlap and the same job
  // would show up as both a best and a worst performer. Split down the middle.
  const bottomCount = Math.min(limit, Math.floor(sortedByProfit.length / 2));
  const topCount = Math.min(limit, sortedByProfit.length - bottomCount);

  return {
    topJobs: sortedByProfit.slice(0, topCount),
    bottomJobs: bottomCount > 0 ? sortedByProfit.slice(-bottomCount).reverse() : [],
  };
}

export function getPricingRecommendations(
  jobs: Job[],
  period: TimePeriod,
  targetHourlyRate: number = 50
): PricingRecommendation[] {
  const performance = getJobTypePerformance(jobs, period);

  return performance
    .filter(p => p.count >= 3 && p.paidHours > 0)
    .map(p => {
      const currentAvgHourlyRate = p.avgHourlyRate;

      // Price to the target rate directly: an hour of work at the target rate,
      // plus the materials that hour consumes. Scaling revenue by the ratio of
      // two PROFIT rates (the old approach) double-counts materials, because
      // materials sit in the price but not in the profit the rate is built on.
      const avgHours = p.paidHours / p.count;
      const recommendedTarget = targetHourlyRate * avgHours + p.avgMaterialsCost;

      // One adjustment figure drives the whole card, so the headline %, the
      // recommended range and the "increase prices by $X" note always agree.
      const priceAdjustmentNeeded =
        p.avgRevenue > 0 ? ((recommendedTarget - p.avgRevenue) / p.avgRevenue) * 100 : 0;

      // Scale the observed price spread by the same factor instead of padding
      // the target with half the min-max range, which produced a band so wide
      // it clamped at minPrice and pushed the midpoint back to today's price.
      const scale = p.avgRevenue > 0 ? recommendedTarget / p.avgRevenue : 1;
      const recommendedMin = p.minPrice * scale;
      const recommendedMax = p.maxPrice * scale;

      return {
        jobType: p.type,
        minPrice: p.minPrice,
        avgPrice: p.avgRevenue,
        maxPrice: p.maxPrice,
        recommendedMin,
        recommendedTarget,
        recommendedMax,
        currentAvgHourlyRate,
        targetHourlyRate,
        priceAdjustmentNeeded,
        avgHours,
        sampleSize: p.count,
      };
    })
    .sort((a, b) => Math.abs(b.priceAdjustmentNeeded) - Math.abs(a.priceAdjustmentNeeded));
}

export function getProfitMarginDistribution(jobs: Job[], period: TimePeriod): ProfitMarginDistribution[] {
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(
    job => job.date_completed && job.final_price
  );

  const ranges = [
    { range: 'Excellent (70%+)', min: 70, max: 100 },
    { range: 'Good (50-70%)', min: 50, max: 70 },
    { range: 'Fair (30-50%)', min: 30, max: 50 },
    { range: 'Poor (<30%)', min: 0, max: 30 },
  ];

  const total = filteredJobs.length;

  return ranges.map(({ range, min, max }) => {
    const jobsInRange = filteredJobs.filter(job => {
      const netProfit = calculateNetProfit(job.final_price, job.materials_cost);
      const margin = job.final_price ? (netProfit / job.final_price) * 100 : 0;
      return margin >= min && margin < max;
    });

    const count = jobsInRange.length;
    const avgRevenue = count > 0
      ? jobsInRange.reduce((sum, job) => sum + (job.final_price || 0), 0) / count
      : 0;

    return {
      range,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
      avgRevenue,
    };
  });
}

export function getMaterialsCostAnalysis(jobs: Job[], period: TimePeriod): MaterialsCostAnalysis[] {
  const performance = getJobTypePerformance(jobs, period);

  return performance.map(p => {
    let suggestion = 'Good';
    if (p.materialsPercent > 40) {
      suggestion = 'High - Consider raising prices or reducing material costs';
    } else if (p.materialsPercent > 30) {
      suggestion = 'Moderate - Monitor closely';
    } else if (p.materialsPercent > 20) {
      suggestion = 'Good - Within healthy range';
    } else {
      suggestion = 'Excellent - Strong profit margins';
    }

    return {
      jobType: p.type,
      avgMaterialsPercent: p.materialsPercent,
      avgMaterialsCost: p.avgMaterialsCost,
      count: p.count,
      totalRevenue: p.totalRevenue,
      suggestion,
    };
  }).sort((a, b) => b.avgMaterialsPercent - a.avgMaterialsPercent);
}

export function calculateConversionMetrics(jobs: Job[], period: TimePeriod): ConversionMetrics {
  const filteredJobs = period === 'all_time' ? jobs : filterJobsByPeriod(jobs, period);

  const quotedJobs = filteredJobs.filter(j => j.job_status === 'quoted').length;
  const acceptedJobs = filteredJobs.filter(j => j.job_status === 'accepted').length;
  const scheduledJobs = filteredJobs.filter(j => j.job_status === 'scheduled').length;
  const inProgressJobs = filteredJobs.filter(j => j.job_status === 'in_progress').length;
  const completedJobs = filteredJobs.filter(j => j.job_status === 'completed').length;
  const lostJobs = filteredJobs.filter(j => j.job_status === 'lost').length;
  const cancelledJobs = filteredJobs.filter(j => j.job_status === 'cancelled').length;

  const totalOpportunities = filteredJobs.length;
  const quoteToCompleteRate = totalOpportunities > 0 ? (completedJobs / totalOpportunities) * 100 : 0;
  const winRate = (completedJobs + lostJobs) > 0 ? (completedJobs / (completedJobs + lostJobs)) * 100 : 0;
  const lossRate = totalOpportunities > 0 ? (lostJobs / totalOpportunities) * 100 : 0;
  const cancellationRate = totalOpportunities > 0 ? (cancelledJobs / totalOpportunities) * 100 : 0;

  const activePipelineValue = filteredJobs
    .filter(j => ['quoted', 'accepted', 'scheduled', 'in_progress'].includes(j.job_status))
    .reduce((sum, j) => sum + (j.quoted_price || 0), 0);

  const lostOpportunityValue = filteredJobs
    .filter(j => j.job_status === 'lost')
    .reduce((sum, j) => sum + (j.quoted_price || 0), 0);

  const completedWithDates = filteredJobs.filter(j =>
    j.job_status === 'completed' && j.date_quoted && j.date_completed
  );

  let avgDaysToComplete = 0;
  if (completedWithDates.length > 0) {
    const totalDays = completedWithDates.reduce((sum, j) => {
      const quotedDate = parseJobDate(j.date_quoted);
      const completedDate = parseJobDate(j.date_completed);
      if (!quotedDate || !completedDate) return sum;
      const days = Math.round((completedDate.getTime() - quotedDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgDaysToComplete = totalDays / completedWithDates.length;
  }

  return {
    totalOpportunities,
    quotedJobs,
    acceptedJobs,
    scheduledJobs,
    inProgressJobs,
    completedJobs,
    lostJobs,
    cancelledJobs,
    quoteToCompleteRate,
    winRate,
    lossRate,
    cancellationRate,
    activePipelineValue,
    lostOpportunityValue,
    avgDaysToComplete,
  };
}

export function getLostDealBreakdown(jobs: Job[], period: TimePeriod): LostDealBreakdown[] {
  const filteredJobs = period === 'all_time' ? jobs : filterJobsByPeriod(jobs, period);
  const lostJobs = filteredJobs.filter(j => j.job_status === 'lost');

  const categoryMap = new Map<string, { count: number; totalValue: number }>();

  lostJobs.forEach(job => {
    const category = job.lost_reason_category || 'Not Specified';
    const existing = categoryMap.get(category) || { count: 0, totalValue: 0 };
    categoryMap.set(category, {
      count: existing.count + 1,
      totalValue: existing.totalValue + (job.quoted_price || 0),
    });
  });

  const total = lostJobs.length;

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      totalValue: data.totalValue,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getJobTypeConversionRates(jobs: Job[], period: TimePeriod): JobTypeConversion[] {
  const filteredJobs = period === 'all_time' ? jobs : filterJobsByPeriod(jobs, period);

  const jobTypeMap = new Map<string, {
    quoted: number;
    completed: number;
    lost: number;
    cancelled: number;
    totalQuoteValue: number;
    totalRevenue: number;
  }>();

  filteredJobs.forEach(job => {
    const type = job.job_type || 'Uncategorized';
    const existing = jobTypeMap.get(type) || {
      quoted: 0,
      completed: 0,
      lost: 0,
      cancelled: 0,
      totalQuoteValue: 0,
      totalRevenue: 0,
    };

    if (job.job_status === 'quoted') existing.quoted++;
    if (job.job_status === 'completed') existing.completed++;
    if (job.job_status === 'lost') existing.lost++;
    if (job.job_status === 'cancelled') existing.cancelled++;

    existing.totalQuoteValue += (job.quoted_price || 0);
    if (job.job_status === 'completed') {
      existing.totalRevenue += (job.final_price || 0);
    }

    jobTypeMap.set(type, existing);
  });

  return Array.from(jobTypeMap.entries())
    .map(([jobType, data]) => {
      const totalQuoted = data.quoted + data.completed + data.lost + data.cancelled;
      const winRate = (data.completed + data.lost) > 0
        ? (data.completed / (data.completed + data.lost)) * 100
        : 0;
      const avgQuoteValue = totalQuoted > 0 ? data.totalQuoteValue / totalQuoted : 0;

      return {
        jobType,
        totalQuoted,
        completed: data.completed,
        lost: data.lost,
        cancelled: data.cancelled,
        winRate,
        avgQuoteValue,
        totalRevenue: data.totalRevenue,
      };
    })
    .filter(item => item.totalQuoted > 0)
    .sort((a, b) => b.totalQuoted - a.totalQuoted);
}

export function getQuoteVarianceJobs(jobs: Job[], period: TimePeriod): QuoteVarianceJob[] {
  return filterJobsByPeriod(jobs, period)
    .filter(job => job.date_completed && (job.quoted_price || 0) > 0 && job.final_price !== null)
    .map(job => {
      const quoted = job.quoted_price!;
      const final_val = job.final_price!;
      const dollarDifference = final_val - quoted;
      const percentDifference = quoted !== 0 ? (dollarDifference / quoted) * 100 : 0;

      return {
        id: job.id,
        client_name: job.client_name,
        job_type: job.job_type || 'Uncategorized',
        date_completed: job.date_completed,
        quoted_price: quoted,
        final_price: final_val,
        dollarDifference,
        percentDifference,
      };
    })
    .sort((a, b) => Math.abs(b.percentDifference) - Math.abs(a.percentDifference));
}

export function getQuoteAccuracyTimeSeries(jobs: Job[], period: TimePeriod): QuoteAccuracyMonthly[] {
  const filtered = filterJobsByPeriod(jobs, period)
    .filter(job => job.date_completed && (job.quoted_price || 0) > 0 && job.final_price !== null);

  const monthMap = new Map<string, { variances: number[]; totalQuoted: number; totalFinal: number }>();

  filtered.forEach(job => {
    const date = parseJobDate(job.date_completed);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { variances: [], totalQuoted: 0, totalFinal: 0 });
    }

    const entry = monthMap.get(key)!;
    const variance = ((job.final_price! - job.quoted_price!) / job.quoted_price!) * 100;
    entry.variances.push(variance);
    entry.totalQuoted += job.quoted_price!;
    entry.totalFinal += job.final_price!;
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      return {
        month: label,
        avgVariancePercent: data.variances.reduce((s, v) => s + v, 0) / data.variances.length,
        jobCount: data.variances.length,
        totalQuoted: data.totalQuoted,
        totalFinal: data.totalFinal,
      };
    });
}

/**
 * Filters completed jobs to a date range using local calendar days.
 *
 * The caller supplies range boundaries built from local Date parts, so the job
 * side has to be parsed the same way — see parseJobDate. Comparing a local
 * midnight boundary against a UTC-parsed job date dropped jobs completed on the
 * first day of the range for anyone west of UTC.
 */
export function filterJobsByDateRange(
  jobs: Job[],
  startDate: Date | null,
  endDate: Date | null
): Job[] {
  if (!startDate || !endDate) return jobs.filter(job => job.date_completed);

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  return jobs.filter(job => {
    const completed = parseJobDate(job.date_completed);
    if (!completed) return false;
    const ms = completed.getTime();
    return ms >= startMs && ms <= endMs;
  });
}

/**
 * The date a job belongs to for pipeline purposes.
 *
 * Conversion analytics have to include jobs that were never completed — quoted,
 * lost, cancelled, still in progress. Those have no date_completed, so dating
 * them by completion (as the revenue views do) erased them from the funnel
 * entirely: pipeline value read $0 and win rate was pinned at 100%.
 */
export function getPipelineDate(job: Job): Date | null {
  return (
    parseJobDate(job.date_completed) ??
    parseJobDate(job.date_quoted) ??
    parseJobDate(job.date_scheduled) ??
    parseJobDate(job.created_at)
  );
}

/** Filters jobs to a date range for funnel/conversion analytics. */
export function filterPipelineJobsByDateRange(
  jobs: Job[],
  startDate: Date | null,
  endDate: Date | null
): Job[] {
  if (!startDate || !endDate) return jobs;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  return jobs.filter(job => {
    const date = getPipelineDate(job);
    if (!date) return false;
    const ms = date.getTime();
    return ms >= startMs && ms <= endMs;
  });
}
