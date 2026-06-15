import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Target } from 'lucide-react';
import { QuoteAccuracyMonthly } from '../../services/analyticsService';

interface QuoteAccuracyChartProps {
  data: QuoteAccuracyMonthly[];
}

export default function QuoteAccuracyChart({ data }: QuoteAccuracyChartProps) {
  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getBarColor = (value: number) => {
    const abs = Math.abs(value);
    if (abs <= 5) return '#10b981';
    if (abs <= 15) return '#f59e0b';
    return '#ef4444';
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Target className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Quote Accuracy Over Time</h3>
            <p className="text-sm text-slate-600">Monthly average variance between quoted and final price</p>
          </div>
        </div>
        <div className="h-48 flex items-center justify-center text-slate-500">
          No jobs with both quoted and final prices in this period
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Quote Accuracy Over Time</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Monthly average variance between quoted and final price. 0% = perfectly accurate quotes.
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatPercent(value), 'Avg Variance']}
                labelFormatter={(label) => label}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} />
              <Bar dataKey="avgVariancePercent" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.avgVariancePercent)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            Within 5% (Excellent)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            5-15% (Acceptable)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            Over 15% (Needs Review)
          </div>
        </div>
      </div>
    </div>
  );
}
