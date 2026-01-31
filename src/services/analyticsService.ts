import { supabase } from '../lib/supabase';
import { Job } from '../lib/supabase';

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalNetProfit: number;
  profitPerHour: number;
  avgHourlyRate: number;
  jobsThisMonth: number;
  revenueThisMonth: number;
  repeatClientPercent: number;
  avgHoursPerJob: number;
  avgRevenuePerJob: number;
  totalJobs: number;
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

function calculateNetProfit(finalPrice: number | null, materialsCost: number | null): number {
  if (finalPrice === null) return 0;
  const materials = materialsCost || 0;
  return finalPrice - materials;
}

function filterJobsByPeriod(jobs: Job[], period: TimePeriod): Job[] {
  if (period === 'all_time') return jobs;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return jobs.filter(job => {
    if (!job.date_completed) return false;
    const jobDate = new Date(job.date_completed);
    const jobYear = jobDate.getFullYear();
    const jobMonth = jobDate.getMonth();

    switch (period) {
      case 'current_month':
        return jobYear === currentYear && jobMonth === currentMonth;

      case 'last_3_months': {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return jobDate >= threeMonthsAgo;
      }

      case 'last_6_months': {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return jobDate >= sixMonthsAgo;
      }

      case 'current_year':
        return jobYear === currentYear;

      default:
        return true;
    }
  });
}

export async function fetchJobsData(businessId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('date_completed', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  return data || [];
}

export function calculateMetrics(jobs: Job[], period: TimePeriod): AnalyticsMetrics {
  const filteredJobs = filterJobsByPeriod(jobs, period);
  const completedJobs = filteredJobs.filter(job => job.date_completed);

  const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.final_price || 0), 0);
  const totalNetProfit = completedJobs.reduce(
    (sum, job) => sum + calculateNetProfit(job.final_price, job.materials_cost),
    0
  );
  const totalHours = completedJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
  const profitPerHour = totalHours > 0 ? totalNetProfit / totalHours : 0;
  const avgHourlyRate = profitPerHour;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const jobsThisMonthList = completedJobs.filter(job => {
    if (!job.date_completed) return false;
    const jobDate = new Date(job.date_completed);
    return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
  });

  const jobsThisMonth = jobsThisMonthList.length;
  const revenueThisMonth = jobsThisMonthList.reduce((sum, job) => sum + (job.final_price || 0), 0);

  const repeatClients = completedJobs.filter(job => job.repeat_client).length;
  const repeatClientPercent = completedJobs.length > 0 ? (repeatClients / completedJobs.length) * 100 : 0;

  const avgHoursPerJob = completedJobs.length > 0 ? totalHours / completedJobs.length : 0;
  const avgRevenuePerJob = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  const profitMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
  const revenuePerHourRatio = totalHours > 0 ? totalRevenue / totalHours : 0;

  const jobsWithQuotes = completedJobs.filter(job => job.quoted_price && job.final_price);
  const quotedVsFinalRatio = jobsWithQuotes.length > 0
    ? jobsWithQuotes.reduce((sum, job) => sum + ((job.final_price || 0) / (job.quoted_price || 1)), 0) / jobsWithQuotes.length
    : 1;

  return {
    totalRevenue,
    totalNetProfit,
    profitPerHour,
    avgHourlyRate,
    jobsThisMonth,
    revenueThisMonth,
    repeatClientPercent,
    avgHoursPerJob,
    avgRevenuePerJob,
    totalJobs: completedJobs.length,
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
    if (!job.date_completed) return;

    const date = new Date(job.date_completed);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

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
  minPrice: number;
  maxPrice: number;
  avgMaterialsCost: number;
  materialsPercent: number;
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
  recommendedMax: number;
  currentAvgHourlyRate: number;
  targetHourlyRate: number;
  priceAdjustmentNeeded: number;
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
  const filteredJobs = filterJobsByPeriod(jobs, period).filter(
    job => job.date_completed && job.final_price && job.hours_worked
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
      const totalMaterialsCost = typeJobs.reduce((sum, job) => sum + (job.materials_cost || 0), 0);
      const count = typeJobs.length;

      const prices = typeJobs.map(job => job.final_price || 0).filter(price => price > 0);

      return {
        type,
        count,
        totalRevenue,
        totalNetProfit,
        avgRevenue: totalRevenue / count,
        avgNetProfit: totalNetProfit / count,
        avgHours: totalHours / count,
        avgHourlyRate: totalHours > 0 ? totalNetProfit / totalHours : 0,
        profitMargin: totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0,
        totalHours,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        avgMaterialsCost: totalMaterialsCost / count,
        materialsPercent: totalRevenue > 0 ? (totalMaterialsCost / totalRevenue) * 100 : 0,
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
    job => job.date_completed && job.final_price && job.hours_worked
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

  return {
    topJobs: sortedByProfit.slice(0, limit),
    bottomJobs: sortedByProfit.slice(-limit).reverse(),
  };
}

export function getPricingRecommendations(
  jobs: Job[],
  period: TimePeriod,
  targetHourlyRate: number = 50
): PricingRecommendation[] {
  const performance = getJobTypePerformance(jobs, period);

  return performance
    .filter(p => p.count >= 3)
    .map(p => {
      const currentAvgHourlyRate = p.avgHourlyRate;
      const priceAdjustmentNeeded =
        currentAvgHourlyRate > 0 ? ((targetHourlyRate - currentAvgHourlyRate) / currentAvgHourlyRate) * 100 : 0;

      const recommendedAvgPrice = p.avgRevenue * (1 + priceAdjustmentNeeded / 100);
      const priceRange = p.maxPrice - p.minPrice;
      const recommendedMin = Math.max(p.minPrice, recommendedAvgPrice - priceRange / 2);
      const recommendedMax = recommendedAvgPrice + priceRange / 2;

      return {
        jobType: p.type,
        minPrice: p.minPrice,
        avgPrice: p.avgRevenue,
        maxPrice: p.maxPrice,
        recommendedMin,
        recommendedMax,
        currentAvgHourlyRate,
        targetHourlyRate,
        priceAdjustmentNeeded,
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
      const quotedDate = new Date(j.date_quoted!);
      const completedDate = new Date(j.date_completed!);
      const days = Math.floor((completedDate.getTime() - quotedDate.getTime()) / (1000 * 60 * 60 * 24));
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
