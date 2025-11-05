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

export type TimePeriod = 'current_year' | 'all_time';

function calculateNetProfit(finalPrice: number | null, materialsCost: number | null): number {
  if (finalPrice === null) return 0;
  const materials = materialsCost || 0;
  return finalPrice - materials;
}

function filterJobsByPeriod(jobs: Job[], period: TimePeriod): Job[] {
  if (period === 'all_time') return jobs;

  const currentYear = new Date().getFullYear();
  return jobs.filter(job => {
    if (!job.date_completed) return false;
    const jobYear = new Date(job.date_completed).getFullYear();
    return jobYear === currentYear;
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
