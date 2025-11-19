import { supabase } from '../lib/supabase';
import { Job } from '../lib/supabase';

export interface ForecastDataPoint {
  date: Date;
  predictedRevenue: number;
  predictedJobCount: number;
  confidenceLower: number;
  confidenceUpper: number;
  isHistorical?: boolean;
  actualRevenue?: number;
  actualJobCount?: number;
}

export interface ForecastSettings {
  id?: string;
  businessId: string;
  forecastMonths: number;
  growthRateOverride: number | null;
  seasonalityEnabled: boolean;
  modelPreference: 'auto' | 'linear' | 'exponential' | 'seasonal' | 'ensemble';
  confidenceLevel: number;
  maxMonthlyJobCapacity?: number;
  lastGeneratedAt?: Date;
}

export interface MonthlyStats {
  month: Date;
  revenue: number;
  jobCount: number;
}

export interface ForecastResult {
  forecasts: ForecastDataPoint[];
  settings: ForecastSettings;
  accuracy?: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalityDetected: boolean;
}

const MAX_GROWTH_RATE = 2.0;
const MIN_GROWTH_RATE = -0.5;

function getMonthlyHistoricalData(jobs: Job[]): MonthlyStats[] {
  const completedJobs = jobs.filter(job => job.date_completed);
  const monthMap = new Map<string, { revenue: number; jobCount: number }>();

  completedJobs.forEach(job => {
    if (!job.date_completed) return;

    const date = new Date(job.date_completed);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const existing = monthMap.get(monthKey) || { revenue: 0, jobCount: 0 };
    monthMap.set(monthKey, {
      revenue: existing.revenue + (job.final_price || 0),
      jobCount: existing.jobCount + 1,
    });
  });

  const sortedEntries = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sortedEntries.map(([key, data]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      month: new Date(year, month - 1, 1),
      revenue: data.revenue,
      jobCount: data.jobCount,
    };
  });
}

function detectSeasonality(monthlyData: MonthlyStats[]): boolean {
  if (monthlyData.length < 12) return false;

  const revenueByMonth = new Map<number, number[]>();

  monthlyData.forEach(stat => {
    const month = stat.month.getMonth();
    if (!revenueByMonth.has(month)) {
      revenueByMonth.set(month, []);
    }
    revenueByMonth.get(month)!.push(stat.revenue);
  });

  const avgRevenueByMonth = Array.from(revenueByMonth.entries()).map(([month, revenues]) => {
    const avg = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    return { month, avg };
  });

  if (avgRevenueByMonth.length < 12) return false;

  const overallAvg =
    avgRevenueByMonth.reduce((sum, m) => sum + m.avg, 0) / avgRevenueByMonth.length;
  const variance =
    avgRevenueByMonth.reduce((sum, m) => sum + Math.pow(m.avg - overallAvg, 2), 0) /
    avgRevenueByMonth.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = overallAvg > 0 ? stdDev / overallAvg : 0;

  return coefficientOfVariation > 0.15;
}

function calculateTrend(monthlyData: MonthlyStats[]): 'increasing' | 'decreasing' | 'stable' {
  if (monthlyData.length < 3) return 'stable';

  const recentMonths = monthlyData.slice(-6);
  const olderMonths = monthlyData.slice(-12, -6);

  if (olderMonths.length === 0) return 'stable';

  const recentAvg = recentMonths.reduce((sum, m) => sum + m.revenue, 0) / recentMonths.length;
  const olderAvg = olderMonths.reduce((sum, m) => sum + m.revenue, 0) / olderMonths.length;

  const percentChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  if (percentChange > 10) return 'increasing';
  if (percentChange < -10) return 'decreasing';
  return 'stable';
}

function linearRegression(monthlyData: MonthlyStats[]): { slope: number; intercept: number; xMean: number; sumXSquaredDev: number } {
  const n = monthlyData.length;
  if (n === 0) return { slope: 0, intercept: 0, xMean: 0, sumXSquaredDev: 1 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  monthlyData.forEach((stat, index) => {
    const x = index;
    const y = stat.revenue;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const xMean = sumX / n;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const sumXSquaredDev = monthlyData.reduce((sum, _, index) => {
    return sum + Math.pow(index - xMean, 2);
  }, 0);

  return { slope, intercept, xMean, sumXSquaredDev: Math.max(sumXSquaredDev, 1) };
}

function getZScoreForConfidence(confidenceLevel: number): number {
  const confidenceMap: Record<number, number> = {
    80: 1.28,
    85: 1.44,
    90: 1.645,
    95: 1.96,
    99: 2.576,
  };

  return confidenceMap[confidenceLevel] || 1.96;
}

function calculateSeasonalIndices(monthlyData: MonthlyStats[]): Map<number, number> {
  const indices = new Map<number, number>();

  if (monthlyData.length < 12) {
    for (let i = 0; i < 12; i++) {
      indices.set(i, 1.0);
    }
    return indices;
  }

  const revenueByMonth = new Map<number, number[]>();

  monthlyData.forEach(stat => {
    const month = stat.month.getMonth();
    if (!revenueByMonth.has(month)) {
      revenueByMonth.set(month, []);
    }
    revenueByMonth.get(month)!.push(stat.revenue);
  });

  const overallAvg =
    monthlyData.reduce((sum, m) => sum + m.revenue, 0) / monthlyData.length;

  for (let month = 0; month < 12; month++) {
    const monthRevenues = revenueByMonth.get(month) || [];
    if (monthRevenues.length > 0) {
      const monthAvg =
        monthRevenues.reduce((sum, r) => sum + r, 0) / monthRevenues.length;
      const index = overallAvg > 0 ? monthAvg / overallAvg : 1.0;
      indices.set(month, index);
    } else {
      indices.set(month, 1.0);
    }
  }

  let sumIndices = 0;
  for (let month = 0; month < 12; month++) {
    sumIndices += indices.get(month) || 1.0;
  }

  const normalizationFactor = sumIndices > 0 ? 12 / sumIndices : 1.0;

  for (let month = 0; month < 12; month++) {
    const currentIndex = indices.get(month) || 1.0;
    indices.set(month, currentIndex * normalizationFactor);
  }

  return indices;
}

function calculateGrowthRate(monthlyData: MonthlyStats[], growthRateOverride: number | null): number {
  if (growthRateOverride !== null) {
    const rate = growthRateOverride / 100;
    return Math.max(MIN_GROWTH_RATE, Math.min(MAX_GROWTH_RATE, rate));
  }

  if (monthlyData.length < 2) return 0;

  const firstHalf = monthlyData.slice(0, Math.floor(monthlyData.length / 2));
  const secondHalf = monthlyData.slice(Math.floor(monthlyData.length / 2));

  if (firstHalf.length === 0 || secondHalf.length === 0) return 0;

  const firstAvg = firstHalf.reduce((sum, m) => sum + m.revenue, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, m) => sum + m.revenue, 0) / secondHalf.length;

  if (firstAvg === 0) return 0;

  const totalGrowth = (secondAvg - firstAvg) / firstAvg;
  const periodsCount = secondHalf.length;
  const monthlyGrowthRate = totalGrowth / periodsCount;

  return Math.max(MIN_GROWTH_RATE, Math.min(MAX_GROWTH_RATE, monthlyGrowthRate));
}

function calculateAverageRevenuePerJob(monthlyData: MonthlyStats[]): number {
  if (monthlyData.length === 0) return 0;

  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
  const totalJobs = monthlyData.reduce((sum, m) => sum + m.jobCount, 0);

  return totalJobs > 0 ? totalRevenue / totalJobs : 0;
}

function generateLinearForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  if (monthlyData.length === 0) {
    return [];
  }

  const { slope, intercept, xMean, sumXSquaredDev } = linearRegression(monthlyData);
  const forecasts: ForecastDataPoint[] = [];

  const lastDate = new Date(monthlyData[monthlyData.length - 1].month);
  const growthRate = calculateGrowthRate(monthlyData, settings.growthRateOverride);
  const avgRevenuePerJob = calculateAverageRevenuePerJob(monthlyData);
  const zScore = getZScoreForConfidence(settings.confidenceLevel);

  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    const baseIndex = monthlyData.length + i - 1;
    let predictedRevenue: number;

    if (settings.growthRateOverride !== null && monthlyData.length > 0) {
      const lastRevenue = monthlyData[monthlyData.length - 1].revenue;
      predictedRevenue = lastRevenue * Math.pow(1 + growthRate, i);
    } else {
      predictedRevenue = slope * baseIndex + intercept;
    }

    predictedRevenue = Math.max(0, predictedRevenue);

    const standardError = calculateStandardError(monthlyData, slope, intercept);

    const predictionVarianceFactor = 1 + (1 / monthlyData.length) +
      Math.pow(baseIndex - xMean, 2) / sumXSquaredDev;

    const adjustedStandardError = standardError * Math.sqrt(predictionVarianceFactor);
    const margin = zScore * adjustedStandardError * Math.sqrt(i);

    const predictedJobCount = avgRevenuePerJob > 0
      ? Math.round(predictedRevenue / avgRevenuePerJob)
      : 0;

    const cappedJobCount = settings.maxMonthlyJobCapacity
      ? Math.min(predictedJobCount, settings.maxMonthlyJobCapacity)
      : predictedJobCount;

    forecasts.push({
      date: forecastDate,
      predictedRevenue,
      predictedJobCount: Math.max(0, cappedJobCount),
      confidenceLower: Math.max(0, predictedRevenue - margin),
      confidenceUpper: predictedRevenue + margin,
    });
  }

  return forecasts;
}

function calculateStandardError(
  monthlyData: MonthlyStats[],
  slope: number,
  intercept: number
): number {
  if (monthlyData.length < 2) return 0;

  const sumSquaredErrors = monthlyData.reduce((sum, stat, index) => {
    const predicted = slope * index + intercept;
    const actual = stat.revenue;
    return sum + Math.pow(actual - predicted, 2);
  }, 0);

  return Math.sqrt(sumSquaredErrors / (monthlyData.length - 2));
}

function generateSeasonalForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  const linearForecasts = generateLinearForecast(monthlyData, forecastMonths, settings);

  if (!settings.seasonalityEnabled || monthlyData.length < 12) {
    return linearForecasts;
  }

  const seasonalIndices = calculateSeasonalIndices(monthlyData);
  const avgRevenuePerJob = calculateAverageRevenuePerJob(monthlyData);

  return linearForecasts.map(forecast => {
    const month = forecast.date.getMonth();
    const seasonalIndex = seasonalIndices.get(month) || 1.0;

    const adjustedRevenue = forecast.predictedRevenue * seasonalIndex;
    const adjustedJobCount = avgRevenuePerJob > 0
      ? Math.round(adjustedRevenue / avgRevenuePerJob)
      : forecast.predictedJobCount;

    const cappedJobCount = settings.maxMonthlyJobCapacity
      ? Math.min(adjustedJobCount, settings.maxMonthlyJobCapacity)
      : adjustedJobCount;

    return {
      ...forecast,
      predictedRevenue: adjustedRevenue,
      predictedJobCount: Math.max(0, cappedJobCount),
      confidenceLower: forecast.confidenceLower * seasonalIndex,
      confidenceUpper: forecast.confidenceUpper * seasonalIndex,
    };
  });
}

function generateExponentialForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  if (monthlyData.length < 2) {
    return generateLinearForecast(monthlyData, forecastMonths, settings);
  }

  const alpha = 0.3;
  const beta = 0.1;

  let level = monthlyData[0].revenue;
  let trend = monthlyData.length > 1
    ? monthlyData[1].revenue - monthlyData[0].revenue
    : 0;

  const levelHistory: number[] = [level];
  const trendHistory: number[] = [trend];

  for (let i = 1; i < monthlyData.length; i++) {
    const prevLevel = level;
    const prevTrend = trend;

    level = alpha * monthlyData[i].revenue + (1 - alpha) * (prevLevel + prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;

    levelHistory.push(level);
    trendHistory.push(trend);
  }

  const forecasts: ForecastDataPoint[] = [];
  const lastDate = new Date(monthlyData[monthlyData.length - 1].month);
  const avgRevenuePerJob = calculateAverageRevenuePerJob(monthlyData);
  const zScore = getZScoreForConfidence(settings.confidenceLevel);

  const residuals = monthlyData.map((stat, index) => {
    if (index === 0) return 0;
    const fitted = levelHistory[index - 1] + trendHistory[index - 1];
    return stat.revenue - fitted;
  });

  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(residuals.length - 1, 1);
  const standardError = Math.sqrt(mse);

  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    const predictedRevenue = Math.max(0, level + trend * i);

    const margin = zScore * standardError * Math.sqrt(i);

    const predictedJobCount = avgRevenuePerJob > 0
      ? Math.round(predictedRevenue / avgRevenuePerJob)
      : 0;

    const cappedJobCount = settings.maxMonthlyJobCapacity
      ? Math.min(predictedJobCount, settings.maxMonthlyJobCapacity)
      : predictedJobCount;

    forecasts.push({
      date: forecastDate,
      predictedRevenue,
      predictedJobCount: Math.max(0, cappedJobCount),
      confidenceLower: Math.max(0, predictedRevenue - margin),
      confidenceUpper: predictedRevenue + margin,
    });
  }

  return forecasts;
}

function generateEnsembleForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  const linearForecasts = generateLinearForecast(monthlyData, forecastMonths, settings);
  const seasonalForecasts = generateSeasonalForecast(monthlyData, forecastMonths, settings);
  const exponentialForecasts = generateExponentialForecast(monthlyData, forecastMonths, settings);

  const weights = { linear: 0.3, seasonal: 0.4, exponential: 0.3 };

  return linearForecasts.map((_, index) => {
    const linear = linearForecasts[index];
    const seasonal = seasonalForecasts[index];
    const exponential = exponentialForecasts[index];

    const predictedRevenue =
      linear.predictedRevenue * weights.linear +
      seasonal.predictedRevenue * weights.seasonal +
      exponential.predictedRevenue * weights.exponential;

    const confidenceLower =
      linear.confidenceLower * weights.linear +
      seasonal.confidenceLower * weights.seasonal +
      exponential.confidenceLower * weights.exponential;

    const confidenceUpper =
      linear.confidenceUpper * weights.linear +
      seasonal.confidenceUpper * weights.seasonal +
      exponential.confidenceUpper * weights.exponential;

    const predictedJobCount = Math.round(
      linear.predictedJobCount * weights.linear +
        seasonal.predictedJobCount * weights.seasonal +
        exponential.predictedJobCount * weights.exponential
    );

    const cappedJobCount = settings.maxMonthlyJobCapacity
      ? Math.min(predictedJobCount, settings.maxMonthlyJobCapacity)
      : predictedJobCount;

    return {
      date: linear.date,
      predictedRevenue,
      predictedJobCount: Math.max(0, cappedJobCount),
      confidenceLower,
      confidenceUpper,
    };
  });
}

export async function generateForecast(
  jobs: Job[],
  settings: ForecastSettings
): Promise<ForecastResult> {
  const monthlyData = getMonthlyHistoricalData(jobs);
  const seasonalityDetected = detectSeasonality(monthlyData);
  const trend = calculateTrend(monthlyData);

  let forecasts: ForecastDataPoint[];

  switch (settings.modelPreference) {
    case 'linear':
      forecasts = generateLinearForecast(monthlyData, settings.forecastMonths, settings);
      break;
    case 'exponential':
      forecasts = generateExponentialForecast(monthlyData, settings.forecastMonths, settings);
      break;
    case 'seasonal':
      forecasts = generateSeasonalForecast(monthlyData, settings.forecastMonths, settings);
      break;
    case 'ensemble':
      forecasts = generateEnsembleForecast(monthlyData, settings.forecastMonths, settings);
      break;
    case 'auto':
    default:
      if (seasonalityDetected && monthlyData.length >= 12) {
        forecasts = generateSeasonalForecast(monthlyData, settings.forecastMonths, settings);
      } else if (monthlyData.length >= 6) {
        forecasts = generateEnsembleForecast(monthlyData, settings.forecastMonths, settings);
      } else {
        forecasts = generateLinearForecast(monthlyData, settings.forecastMonths, settings);
      }
      break;
  }

  const historicalForecasts: ForecastDataPoint[] = monthlyData.map(stat => ({
    date: stat.month,
    predictedRevenue: stat.revenue,
    predictedJobCount: stat.jobCount,
    confidenceLower: stat.revenue,
    confidenceUpper: stat.revenue,
    isHistorical: true,
    actualRevenue: stat.revenue,
    actualJobCount: stat.jobCount,
  }));

  return {
    forecasts: [...historicalForecasts, ...forecasts],
    settings,
    trend,
    seasonalityDetected,
  };
}

export async function saveForecastSettings(settings: ForecastSettings): Promise<void> {
  const { data: existing } = await supabase
    .from('forecast_settings')
    .select('id')
    .eq('business_id', settings.businessId)
    .maybeSingle();

  const settingsData = {
    business_id: settings.businessId,
    forecast_months: settings.forecastMonths,
    growth_rate_override: settings.growthRateOverride,
    seasonality_enabled: settings.seasonalityEnabled,
    model_preference: settings.modelPreference,
    confidence_level: settings.confidenceLevel,
    last_generated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from('forecast_settings')
      .update(settingsData)
      .eq('id', existing.id);
  } else {
    await supabase.from('forecast_settings').insert(settingsData);
  }
}

export async function loadForecastSettings(businessId: string): Promise<ForecastSettings | null> {
  const { data, error } = await supabase
    .from('forecast_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    businessId: data.business_id,
    forecastMonths: data.forecast_months,
    growthRateOverride: data.growth_rate_override,
    seasonalityEnabled: data.seasonality_enabled,
    modelPreference: data.model_preference,
    confidenceLevel: data.confidence_level,
    lastGeneratedAt: data.last_generated_at ? new Date(data.last_generated_at) : undefined,
  };
}

export async function saveForecastData(
  businessId: string,
  forecasts: ForecastDataPoint[],
  modelType: string
): Promise<void> {
  await supabase
    .from('revenue_forecasts')
    .delete()
    .eq('business_id', businessId)
    .eq('model_type', modelType);

  const forecastRecords = forecasts
    .filter(f => !f.isHistorical)
    .map(forecast => ({
      business_id: businessId,
      forecast_date: forecast.date.toISOString().split('T')[0],
      predicted_revenue: forecast.predictedRevenue,
      predicted_job_count: forecast.predictedJobCount,
      confidence_lower: forecast.confidenceLower,
      confidence_upper: forecast.confidenceUpper,
      confidence_level: 95,
      model_type: modelType,
      generated_at: new Date().toISOString(),
    }));

  if (forecastRecords.length > 0) {
    await supabase.from('revenue_forecasts').insert(forecastRecords);
  }
}

export async function loadForecastData(
  businessId: string,
  modelType: string
): Promise<ForecastDataPoint[]> {
  const { data, error } = await supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('business_id', businessId)
    .eq('model_type', modelType)
    .eq('is_active', true)
    .order('forecast_date', { ascending: true });

  if (error || !data) return [];

  return data.map(record => ({
    date: new Date(record.forecast_date),
    predictedRevenue: record.predicted_revenue,
    predictedJobCount: record.predicted_job_count,
    confidenceLower: record.confidence_lower,
    confidenceUpper: record.confidence_upper,
  }));
}

export function exportForecastToCSV(forecasts: ForecastDataPoint[]): string {
  const headers = [
    'Date',
    'Predicted Revenue',
    'Predicted Jobs',
    'Lower Bound',
    'Upper Bound',
    'Type',
  ];

  const rows = forecasts.map(f => [
    f.date.toISOString().split('T')[0],
    f.predictedRevenue.toFixed(2),
    f.predictedJobCount.toString(),
    f.confidenceLower.toFixed(2),
    f.confidenceUpper.toFixed(2),
    f.isHistorical ? 'Historical' : 'Forecast',
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
