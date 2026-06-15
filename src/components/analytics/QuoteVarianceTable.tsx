import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, FileSpreadsheet } from 'lucide-react';
import { QuoteVarianceJob } from '../../services/analyticsService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface QuoteVarianceTableProps {
  jobs: QuoteVarianceJob[];
}

export default function QuoteVarianceTable({ jobs }: QuoteVarianceTableProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const [showAll, setShowAll] = useState(false);
  const displayLimit = 15;

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return maskFinancialValue(formatted);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getVarianceColor = (percent: number) => {
    const abs = Math.abs(percent);
    if (abs <= 5) return 'text-slate-600';
    if (percent > 0) return 'text-emerald-600';
    return 'text-red-600';
  };

  const getVarianceBg = (percent: number) => {
    const abs = Math.abs(percent);
    if (abs <= 5) return 'bg-slate-50';
    if (percent > 0) return 'bg-emerald-50';
    return 'bg-red-50';
  };

  const VarianceIcon = ({ percent }: { percent: number }) => {
    const abs = Math.abs(percent);
    if (abs <= 5) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    if (percent > 0) return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />;
    return <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />;
  };

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Quoted vs Final Price Breakdown</h3>
        </div>
        <p className="text-slate-500 text-center py-8">No completed jobs with both quoted and final prices in this period</p>
      </div>
    );
  }

  const totalQuoted = jobs.reduce((sum, j) => sum + j.quoted_price, 0);
  const totalFinal = jobs.reduce((sum, j) => sum + j.final_price, 0);
  const totalDifference = totalFinal - totalQuoted;
  const overallVariance = totalQuoted > 0 ? (totalDifference / totalQuoted) * 100 : 0;

  const displayedJobs = showAll ? jobs : jobs.slice(0, displayLimit);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Quoted vs Final Price Breakdown</h3>
              <p className="text-xs sm:text-sm text-slate-600">{jobs.length} jobs with both prices recorded</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Overall Variance</p>
              <p className={`text-lg font-bold ${getVarianceColor(overallVariance)}`}>
                {overallVariance > 0 ? '+' : ''}{overallVariance.toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Net Difference</p>
              <p className={`text-lg font-bold ${getVarianceColor(totalDifference)}`}>
                {formatCurrency(totalDifference)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
        <div className="p-3 sm:p-4 text-center border-r border-slate-200">
          <p className="text-xs text-slate-500">Total Quoted</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900">{formatCurrency(totalQuoted)}</p>
        </div>
        <div className="p-3 sm:p-4 text-center border-r border-slate-200">
          <p className="text-xs text-slate-500">Total Final</p>
          <p className="text-sm sm:text-base font-semibold text-slate-900">{formatCurrency(totalFinal)}</p>
        </div>
        <div className="p-3 sm:p-4 text-center">
          <p className="text-xs text-slate-500">Avg Variance/Job</p>
          <p className={`text-sm sm:text-base font-semibold ${getVarianceColor(overallVariance)}`}>
            {formatCurrency(totalDifference / jobs.length)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Job Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Completed</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Quoted</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Final</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedJobs.map((job) => (
              <tr key={job.id} className={`hover:bg-slate-50 ${getVarianceBg(job.percentDifference)} bg-opacity-30`}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">{job.client_name}</p>
                  <p className="text-xs text-slate-500 sm:hidden">{job.job_type}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm text-slate-600">{job.job_type}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-slate-500">{formatDate(job.date_completed)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-700">{formatCurrency(job.quoted_price)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(job.final_price)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <VarianceIcon percent={job.percentDifference} />
                    <span className={`text-sm font-semibold ${getVarianceColor(job.percentDifference)}`}>
                      {job.percentDifference > 0 ? '+' : ''}{job.percentDifference.toFixed(0)}%
                    </span>
                  </div>
                  <p className={`text-xs ${getVarianceColor(job.dollarDifference)}`}>
                    {job.dollarDifference >= 0 ? '+' : ''}{formatCurrency(job.dollarDifference)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length > displayLimit && (
        <div className="p-4 border-t border-slate-200 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {showAll ? 'Show Less' : `Show All ${jobs.length} Jobs`}
          </button>
        </div>
      )}
    </div>
  );
}
