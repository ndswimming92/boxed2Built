import React from 'react';
import { TrendingUp } from 'lucide-react';
import { ProfitabilityJob } from '../../services/analyticsService';

interface ProfitabilityLeaderboardProps {
  topJobs: ProfitabilityJob[];
}

export default function ProfitabilityLeaderboard({ topJobs }: ProfitabilityLeaderboardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderJobRow = (job: ProfitabilityJob, index: number) => (
    <tr key={job.id} className="border-b border-slate-200 last:border-b-0">
      <td className="py-3 px-4 text-sm text-slate-600">{index + 1}</td>
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-medium text-slate-900">{job.client_name}</p>
          <p className="text-xs text-slate-500">{job.job_type}</p>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">{formatDate(job.date_completed)}</td>
      <td className="py-3 px-4 text-sm font-medium text-slate-900">{formatCurrency(job.final_price)}</td>
      <td className="py-3 px-4 text-sm text-slate-600">{formatCurrency(job.materials_cost)}</td>
      <td className="py-3 px-4 text-sm text-slate-600">{job.hours_worked.toFixed(1)} hrs</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-600">
            {formatCurrency(job.netProfit)}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            job.profitMargin >= 70
              ? 'bg-emerald-100 text-emerald-800'
              : job.profitMargin >= 50
              ? 'bg-blue-100 text-blue-800'
              : job.profitMargin >= 30
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {job.profitMargin.toFixed(0)}%
        </span>
      </td>
      <td className="py-3 px-4 text-sm font-medium text-slate-900">{formatCurrency(job.hourlyRate)}/hr</td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 sm:p-6 border-b border-emerald-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Most Profitable Jobs</h3>
            <p className="text-sm text-slate-600">Your most successful projects</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Rank
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Client / Job Type
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Date
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Revenue
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Materials
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Hours
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Net Profit
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Margin
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {topJobs.length > 0 ? (
              topJobs.map((job, index) => renderJobRow(job, index))
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No jobs data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
