import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { JobTypePerformance } from '../../services/analyticsService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface JobTypePerformanceTableProps {
  performance: JobTypePerformance[];
}

export default function JobTypePerformanceTable({ performance }: JobTypePerformanceTableProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    return maskFinancialValue(formatted);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 70) return 'text-emerald-600 bg-emerald-50';
    if (margin >= 50) return 'text-blue-600 bg-blue-50';
    if (margin >= 30) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getMarginLabel = (margin: number) => {
    if (margin >= 70) return 'Excellent';
    if (margin >= 50) return 'Good';
    if (margin >= 30) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-teal-50">
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Job Type Performance Analysis</h3>
        <p className="text-xs sm:text-sm text-slate-600">Comprehensive breakdown of revenue, profitability, and efficiency by service type</p>
      </div>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">
                Job Type
              </th>
              <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Jobs
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Total Revenue
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Net Profit
              </th>
              <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Margin
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Avg Revenue
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Avg Profit
              </th>
              <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Avg Hours
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Hourly Rate
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Price Range
              </th>
              <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Materials %
              </th>
            </tr>
          </thead>
          <tbody>
            {performance.length > 0 ? (
              performance.map((item, index) => (
                <tr key={item.type} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-slate-900">{item.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {item.count}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-slate-900">
                    {formatCurrency(item.totalRevenue)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.totalNetProfit > 0 ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-600" />
                      )}
                      <span className={`font-medium ${item.totalNetProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(item.totalNetProfit)}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getMarginColor(item.profitMargin)}`}>
                        {formatPercent(item.profitMargin)}
                      </span>
                      <span className="text-xs text-slate-500">{getMarginLabel(item.profitMargin)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-slate-700">
                    {formatCurrency(item.avgRevenue)}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-slate-900">
                    {formatCurrency(item.avgNetProfit)}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-700">
                    {item.avgHours.toFixed(1)} hrs
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-semibold text-teal-600">
                      {formatCurrency(item.avgHourlyRate)}/hr
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-slate-500">
                        {formatCurrency(item.minPrice)} - {formatCurrency(item.maxPrice)}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.materialsPercent > 40
                          ? 'bg-red-100 text-red-800'
                          : item.materialsPercent > 30
                          ? 'bg-amber-100 text-amber-800'
                          : item.materialsPercent > 20
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {formatPercent(item.materialsPercent)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500">
                  No performance data available. Add completed jobs with hours worked to see analysis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {performance.length > 0 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <div className="flex-1 space-y-1">
              <p className="font-medium">Key Insights:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>Focus on job types with high hourly rates and good profit margins</li>
                <li>Consider raising prices for types with materials over 30%</li>
                <li>Job types with consistent pricing (smaller range) are easier to quote</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
