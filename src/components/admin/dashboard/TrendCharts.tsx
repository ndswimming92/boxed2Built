import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import Panel from './Panel';
import type { MonthlyTrendPoint } from '../../../utils/dashboardTrends';

interface TrendChartsProps {
  trend: MonthlyTrendPoint[];
  formatCurrency: (amount: number) => string;
  /** Privacy mode: hides dollar figures (axis, totals, tooltip) but keeps the shape. */
  maskFinancialValue: (value: string | number) => string;
  privacyModeEnabled: boolean;
}

// One series per chart, so one hue for both: the title says what each chart measures.
const BAR_COLOR = '#2563eb';
const AXIS_TEXT = '#64748b';
const GRID = '#e2e8f0';

const compactCurrency = (value: number) =>
  value >= 1000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `$${value}`;

interface MonthlyBarsProps {
  title: string;
  total: string;
  data: MonthlyTrendPoint[];
  dataKey: 'revenue' | 'jobs';
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  hideAxisValues?: boolean;
}

function MonthlyBars({ title, total, data, dataKey, formatValue, formatTick, hideAxisValues }: MonthlyBarsProps) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{total}</p>
      </figcaption>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={4}
            />
            <YAxis
              width={hideAxisValues ? 8 : 40}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={hideAxisValues ? false : { fill: AXIS_TEXT, fontSize: 11 }}
              tickFormatter={formatTick}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as MonthlyTrendPoint;
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-slate-600">
                      {point.fullLabel}
                      {point.inProgress && ' (so far)'}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                      {formatValue(point[dataKey])}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {data.map(point => (
                <Cell key={point.key} fill={BAR_COLOR} fillOpacity={point.inProgress ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Revenue and completed jobs by month, side by side on their own axes. */
export default function TrendCharts({ trend, formatCurrency, maskFinancialValue, privacyModeEnabled }: TrendChartsProps) {
  const totalRevenue = trend.reduce((sum, point) => sum + point.revenue, 0);
  const totalJobs = trend.reduce((sum, point) => sum + point.jobs, 0);
  const hasWork = totalJobs > 0;

  return (
    <Panel
      title="Last 12 months"
      icon={BarChart3}
      subtitle="Completed jobs, by the month they were finished"
      action={{ label: 'Analytics', to: '/admin/analytics' }}
    >
      {hasWork ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <MonthlyBars
              title="Revenue"
              total={maskFinancialValue(formatCurrency(totalRevenue))}
              data={trend}
              dataKey="revenue"
              formatValue={value => maskFinancialValue(formatCurrency(value))}
              formatTick={compactCurrency}
              hideAxisValues={privacyModeEnabled}
            />
            <MonthlyBars
              title="Jobs completed"
              total={String(totalJobs)}
              data={trend}
              dataKey="jobs"
              formatValue={value => `${value} ${value === 1 ? 'job' : 'jobs'}`}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">The lighter bar is the current month, still in progress.</p>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No completed jobs in the last 12 months yet. Finished jobs will chart here.
        </p>
      )}
    </Panel>
  );
}
