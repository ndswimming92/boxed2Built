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
  growthRateOverride: number | null; // percent (e.g., 5 for 5%)
  seasonalityEnabled: boolean;
  modelPreference: 'auto' | 'linear' | 'exponential' | 'seasonal' | 'ensemble';
  confidenceLevel: number; // e.g., 95
  lastGeneratedAt?: Date;
}

export interface MonthlyStats {
  month: Date;     // normalized to first of month
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

/* ----------------------------- Utilities ----------------------------- */

function ymdLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function zFor(confidenceLevel: number): number {
  if (confidenceLevel >= 99) return 2.576;
  if (confidenceLevel >= 95) return 1.96;
  if (confidenceLevel >= 90) return 1.645;
  return 1.96;
}

/* --------------------------- Historical prep ------------------------- */

function getMonthlyHistoricalData(jobs: Job[]): MonthlyStats[] {
  const completedJobs = jobs.filter(j => j.date_completed);
  const monthMap = new Map<string, { revenue: number; jobCount: number }>();

  completedJobs.forEach(job => {
    if (!job.date_completed) return;
    const date = new Date(job.date_completed);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) || { revenue: 0, jobCount: 0 };
    monthMap.set(key, {
      revenue: existing.revenue + (job.final_price || 0),
      jobCount: existing.jobCount + 1,
    });
  });

  const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([key, data]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      month: new Date(year, month - 1, 1),
      revenue: data.revenue,
      jobCount: data.jobCount,
    };
  });
}

function detectSeasonality(monthlyData: MonthlyStats(): boolean);
function detectSeasonality(monthlyData: MonthlyStats[]): boolean {
  if (monthlyData.length < 12) return false;

  const revenueByMonth = new Map<number, number[]>();
  monthlyData.forEach(stat => {
    const m = stat.month.getMonth();
    if (!revenueByMonth.has(m)) revenueByMonth.set(m, []);
    revenueByMonth.get(m)!.push(stat.revenue);
  });

  if (revenueByMonth.size < 12) return false;

  const avgRevenueByMonth = Array.from(revenueByMonth.entries()).map(([m, arr]) => {
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    return { month: m, avg };
  });

  const overallAvg = avgRevenueByMonth.reduce((s, r) => s + r.avg, 0) / avgRevenueByMonth.length;
  if (overallAvg <= 0) return false;

  const variance = avgRevenueByMonth.reduce((s, r) => s + Math.pow(r.avg - overallAvg, 2), 0) / avgRevenueByMonth.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / overallAvg;

  // Threshold ~0.15 is a reasonable heuristic
  return cv > 0.15;
}

function calculateTrend(monthlyData: MonthlyStats[]): 'increasing' | 'decreasing' | 'stable' {
  if (monthlyData.length < 3) return 'stable';

  const recentMonths = monthlyData.slice(-6);
  const olderMonths = monthlyData.slice(-12, -6);
  if (olderMonths.length < 3) return 'stable';

  const recentAvg = recentMonths.reduce((s, m) => s + m.revenue, 0) / recentMonths.length;
  const olderAvg = olderMonths.reduce((s, m) => s + m.revenue, 0) / olderMonths.length;

  if (olderAvg <= 0) return 'stable';
  const pct = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (pct > 10) return 'increasing';
  if (pct < -10) return 'decreasing';
  return 'stable';
}

/* ------------------------- Growth & capacity ------------------------- */

function geometricMonthlyGrowthRate(monthlyData: MonthlyStats[]): number {
  if (monthlyData.length < 2) return 0;
  const first = monthlyData[0].revenue;
  const last = monthlyData[monthlyData.length - 1].revenue;
  if (first <= 0 || last <= 0) return 0;
  const months = monthlyData.length - 1;
  return Math.pow(last / first, 1 / months) - 1; // e.g., 0.05 = 5%
}

function recentJobBase(monthlyData: MonthlyStats[]): number {
  if (!monthlyData.length) return 0;
  const last = monthlyData[monthlyData.length - 1].jobCount;
  const avg = monthlyData.reduce((s, m) => s + m.jobCount, 0) / monthlyData.length;
  return Math.round(0.6 * last + 0.4 * avg); // weight recent month a bit more
}

function clampJobs(predicted: number, monthlyData: MonthlyStats[]): number {
  if (!monthlyData.length) return Math.max(0, predicted);
  const maxHist = Math.max(...monthlyData.map(m => m.jobCount));
  const cap = Math.max(Math.ceil(maxHist * 1.35), 1); // allow ~35% above historical max
  return Math.max(0, Math.min(predicted, cap));
}

/* ---------------------- Linear regression core ----------------------- */

function regressionCore(monthlyData: MonthlyStats[]) {
  const n = monthlyData.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, s: 0, xbar: 0, sxx: 1, n: 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  monthlyData.forEach((stat, i) => {
    const x = i;
    const y = stat.revenue;
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  });

  const denom = (n * sumXX - sumX * sumX) || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // residual std error
  const sse = monthlyData.reduce((acc, stat, i) => {
    const yhat = slope * i + intercept;
    return acc + Math.pow(stat.revenue - yhat, 2);
  }, 0);
  const s = Math.sqrt(Math.max(sse, 0) / Math.max(n - 2, 1));

  const xbar = sumX / n;
  const sxx = sumXX - n * xbar * xbar || 1;

  return { slope, intercept, s, xbar, sxx, n };
}

function predictionStdErrAt(h: number, stats: ReturnType<typeof regressionCore>) {
  // Predict at index = (n - 1) + h
  const x0 = (stats.n - 1) + h;
  const term = 1 + (1 / Math.max(stats.n, 1)) + Math.pow(x0 - stats.xbar, 2) / Math.max(stats.sxx, 1);
  return stats.s * Math.sqrt(term);
}

/* --------------------------- Seasonal indices ------------------------ */

function calculateSeasonalIndices(monthlyData: MonthlyStats[]): Map<number, number> {
  const indices = new Map<number, number>();

  if (monthlyData.length < 12) {
    for (let m = 0; m < 12; m++) indices.set(m, 1.0);
    return indices;
  }

  const byMonth = new Map<number, number[]>();
  monthlyData.forEach(stat => {
    const m = stat.month.getMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(stat.revenue);
  });

  const overallAvg = monthlyData.reduce((s, v) => s + v.revenue, 0) / monthlyData.length || 1;

  for (let m = 0; m < 12; m++) {
    const arr = byMonth.get(m) || [];
    const monthAvg = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : overallAvg;
    indices.set(m, monthAvg / overallAvg);
  }

  // Normalize to mean 1.0 to prevent drift
  const meanIndex = Array.from(indices.values()).reduce((s, v) => s + v, 0) / 12 || 1;
  for (let m = 0; m < 12; m++) indices.set(m, (indices.get(m) || 1) / meanIndex);

  return indices;
}

/* ---------------------------- Generators ----------------------------- */

function generateLinearForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  const stats = regressionCore(monthlyData);
  const forecasts: ForecastDataPoint[] = [];

  const lastDate = monthlyData.length
    ? new Date(monthlyData[monthlyData.length - 1].month)
    : new Date();

  const autoGrowth = geometricMonthlyGrowthRate(monthlyData);
  const growthRate = settings.growthRateOverride !== null
    ? settings.growthRateOverride / 100
    : autoGrowth;

  const z = zFor(settings.confidenceLevel);
  const baseJobs = recentJobBase(monthlyData);

  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    // baseline linear prediction
    let predictedRevenue = stats.slope * (monthlyData.length - 1 + i) + stats.intercept;

    // if explicit growth override, compound from last actual month instead
    if (settings.growthRateOverride !== null && monthlyData.length > 0) {
      const lastRevenue = monthlyData[monthlyData.length - 1].revenue;
      predictedRevenue = lastRevenue * Math.pow(1 + growthRate, i);
    }

    predictedRevenue = Math.max(0, predictedRevenue);

    // proper horizon-widening interval
    const se = predictionStdErrAt(i, stats);
    const margin = z * se;

    forecasts.push({
      date: forecastDate,
      predictedRevenue,
      predictedJobCount: clampJobs(
        Math.round(baseJobs * Math.pow(1 + growthRate, i)),
        monthlyData
      ),
      confidenceLower: Math.max(0, predictedRevenue - margin),
      confidenceUpper: predictedRevenue + margin,
    });
  }

  return forecasts;
}

// Holt’s linear exponential smoothing (level + trend; no seasonality)
function generateExponentialForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  if (monthlyData.length < 2) {
    return generateLinearForecast(monthlyData, forecastMonths, settings);
  }

  // Tunable; reasonable defaults for small business series
  const alpha = 0.5; // level
  const beta  = 0.3; // trend

  // Fit final level & trend
  let level = monthlyData[0].revenue;
  let trend = monthlyData[1].revenue - monthlyData[0].revenue;

  for (let t = 1; t < monthlyData.length; t++) {
    const y = monthlyData[t].revenue;
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Build fitted values to estimate residual variance
  const fitted: number[] = [];
  let L = monthlyData[0].revenue;
  let B = monthlyData[1].revenue - monthlyData[0].revenue;
  for (let t = 1; t < monthlyData.length; t++) {
    const yhat = L + B;
    fitted.push(yhat);
    const y = monthlyData[t].revenue;
    const prevL = L;
    L = alpha * y + (1 - alpha) * (L + B);
    B = beta * (L - prevL) + (1 - beta) * B;
  }
  const residuals = monthlyData.slice(1).map((m, i) => m.revenue - fitted[i]);
  const s = Math.sqrt(
    residuals.reduce((a, r) => a + r * r, 0) / Math.max(residuals.length - 1, 1)
  );
  const z = zFor(settings.confidenceLevel);

  const lastDate = new Date(monthlyData[monthlyData.length - 1].month);
  const baseJobs = recentJobBase(monthlyData);

  // Use final fitted level/trend
  const finalLevel = level;
  const finalTrend = trend;

  const forecasts: ForecastDataPoint[] = [];
  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    const yhat = finalLevel + i * finalTrend;
    const predictedRevenue = Math.max(0, yhat);
    const margin = z * s * Math.sqrt(i); // horizon scaling

    forecasts.push({
      date: forecastDate,
      predictedRevenue,
      predictedJobCount: clampJobs(
        Math.round(baseJobs * Math.pow(1 + ((settings.growthRateOverride ?? 0) / 100), i)),
        monthlyData
      ),
      confidenceLower: Math.max(0, predictedRevenue - margin),
      confidenceUpper: predictedRevenue + margin,
    });
  }

  return forecasts;
}

function generateSeasonalForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  const linear = generateLinearForecast(monthlyData, forecastMonths, settings);

  if (!settings.seasonalityEnabled || monthlyData.length < 12) {
    return linear;
  }

  const seasonalIndices = calculateSeasonalIndices(monthlyData);

  return linear.map(f => {
    const m = f.date.getMonth();
    const idx = seasonalIndices.get(m) || 1.0;
    return {
      ...f,
      predictedRevenue: f.predictedRevenue * idx,
      confidenceLower: f.confidenceLower * idx,
      confidenceUpper: f.confidenceUpper * idx,
    };
  });
}

function generateEnsembleForecast(
  monthlyData: MonthlyStats[],
  forecastMonths: number,
  settings: ForecastSettings
): ForecastDataPoint[] {
  // Bias weights depending on data depth
  const hasYear = monthlyData.length >= 12 && detectSeasonality(monthlyData);
  const shallow = monthlyData.length < 12;

  const w = shallow
    ? { linear: 0.5, seasonal: 0.0, exponential: 0.5 }
    : hasYear
      ? { linear: 0.3, seasonal: 0.4, exponential: 0.3 }
      : { linear: 0.4, seasonal: 0.2, exponential: 0.4 };

  const linear = generateLinearForecast(monthlyData, forecastMonths, settings);
  const seasonal = generateSeasonalForecast(monthlyData, forecastMonths, settings);
  const expo = generateExponentialForecast(monthlyData, forecastMonths, settings);

  return linear.map((_, i) => {
    const L = linear[i], S = seasonal[i], E = expo[i];
    const predictedRevenue =
      L.predictedRevenue * w.linear +
      S.predictedRevenue * w.seasonal +
      E.predictedRevenue * w.exponential;

    const confidenceLower =
      L.confidenceLower * w.linear +
      S.confidenceLower * w.seasonal +
      E.confidenceLower * w.exponential;

    const confidenceUpper =
      L.confidenceUpper * w.linear +
      S.confidenceUpper * w.seasonal +
      E.confidenceUpper * w.exponential;

    const predictedJobCount = clampJobs(
      Math.round(
        L.predictedJobCount * w.linear +
        S.predictedJobCount * w.seasonal +
        E.predictedJobCount * w.exponential
      ),
      // use monthlyData for clamping
      monthlyData
    );

    return {
      date: L.date,
      predictedRevenue,
      predictedJobCount,
      confidenceLower,
      confidenceUpper,
    };
  });
}

/* ---------------------------- Main driver ---------------------------- */

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
        // Very small data: Holt tends to behave better than pure linear
        forecasts = generateExponentialForecast(monthlyData, settings.forecastMonths, settings);
      }
      break;
  }

  const historical: ForecastDataPoint[] = monthlyData.map(stat => ({
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
    forecasts: [...historical, ...forecasts],
    settings,
    trend,
    seasonalityDetected,
  };
}

/* ------------------------- Settings persistence ---------------------- */

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
    await supabase.from('forecast_settings').update(settingsData).eq('id', existing.id);
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

/* -------------------------- Forecast persistence --------------------- */

// NOTE: signature changed to include confidenceLevel for accurate storage
export async function saveForecastData(
  businessId: string,
  forecasts: ForecastDataPoint[],
  modelType: string,
  confidenceLevel: number
): Promise<void> {
  // Clear existing records for this model
  await supabase
    .from('revenue_forecasts')
    .delete()
    .eq('business_id', businessId)
    .eq('model_type', modelType);

  const forecastRecords = forecasts
    .filter(f => !f.isHistorical)
    .map(f => ({
      business_id: businessId,
      forecast_date: ymdLocal(f.date), // keep month boundary consistent
      predicted_revenue: f.predictedRevenue,
      predicted_job_count: f.predictedJobCount,
      confidence_lower: f.confidenceLower,
      confidence_upper: f.confidenceUpper,
      confidence_level: confidenceLevel,
      model_type: modelType,
      is_active: true,
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

  return data.map(rec => ({
    date: new Date(rec.forecast_date),
    predictedRevenue: rec.predicted_revenue,
    predictedJobCount: rec.predicted_job_count,
    confidenceLower: rec.confidence_lower,
    confidenceUpper: rec.confidence_upper,
  }));
}

/* ------------------------------- Export ------------------------------ */

export function exportForecastToCSV(forecasts: ForecastDataPoint[]): string {
  const headers = ['Date', 'Predicted Revenue', 'Predicted Jobs', 'Lower Bound', 'Upper Bound', 'Type'];
  const rows = forecasts.map(f => [
    ymdLocal(f.date),
    f.predictedRevenue.toFixed(2),
    f.predictedJobCount.toString(),
    f.confidenceLower.toFixed(2),
    f.confidenceUpper.toFixed(2),
    f.isHistorical ? 'Historical' : 'Forecast',
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}
