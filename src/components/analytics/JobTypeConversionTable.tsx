import { TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { JobTypeConversion } from '../../services/analyticsService';

interface JobTypeConversionTableProps {
  data: JobTypeConversion[];
}

export default function JobTypeConversionTable({ data }: JobTypeConversionTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Job Type Performance</h3>
          <p className="text-sm text-slate-600">Win rates and conversion by job type</p>
        </div>
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No job data available</p>
        </div>
      </div>
    );
  }

  const avgWinRate = data.reduce((sum, item) => sum + item.winRate, 0) / data.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Job Type Performance</h3>
        <p className="text-sm text-slate-600">Win rates and conversion by job type</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Job Type
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Quoted
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Completed
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Lost
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Win Rate
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Avg Quote
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => {
              const isAboveAvg = item.winRate > avgWinRate;
              const winRateColor = item.winRate >= 75 ? 'text-emerald-600' :
                                   item.winRate >= 50 ? 'text-blue-600' :
                                   item.winRate >= 25 ? 'text-amber-600' : 'text-red-600';

              return (
                <tr key={item.jobType} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{item.jobType}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm text-slate-700">{item.totalQuoted}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-emerald-600">{item.completed}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm text-slate-500">{item.lost}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`text-sm font-semibold ${winRateColor}`}>
                        {item.winRate.toFixed(0)}%
                      </span>
                      {isAboveAvg ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-slate-700">
                      ${item.avgQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      ${item.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs font-medium text-slate-600 mb-1">Average Win Rate</div>
            <div className="text-xl font-bold text-slate-900">{avgWinRate.toFixed(1)}%</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <div className="text-xs font-medium text-emerald-700 mb-1">Best Performer</div>
            <div className="text-sm font-semibold text-emerald-900 truncate">
              {data[0]?.jobType || 'N/A'}
            </div>
            <div className="text-xs text-emerald-600">{data[0]?.winRate.toFixed(0)}% win rate</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="text-xs font-medium text-amber-700 mb-1">Needs Focus</div>
            <div className="text-sm font-semibold text-amber-900 truncate">
              {data[data.length - 1]?.jobType || 'N/A'}
            </div>
            <div className="text-xs text-amber-600">
              {data[data.length - 1]?.winRate.toFixed(0)}% win rate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
