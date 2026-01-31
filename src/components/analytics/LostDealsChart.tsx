import { AlertCircle } from 'lucide-react';
import { LostDealBreakdown } from '../../services/analyticsService';

interface LostDealsChartProps {
  breakdown: LostDealBreakdown[];
}

export default function LostDealsChart({ breakdown }: LostDealsChartProps) {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];

  const totalLost = breakdown.reduce((sum, item) => sum + item.count, 0);
  const totalValue = breakdown.reduce((sum, item) => sum + item.totalValue, 0);

  if (breakdown.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Lost Deals Analysis</h3>
          <p className="text-sm text-slate-600">Breakdown of why deals were lost</p>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No lost deals in this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Lost Deals Analysis</h3>
        <p className="text-sm text-slate-600">Breakdown of why deals were lost</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="text-xs font-medium text-red-700 mb-1">Total Lost</div>
          <div className="text-2xl font-bold text-red-600">{totalLost}</div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="text-xs font-medium text-red-700 mb-1">Lost Value</div>
          <div className="text-2xl font-bold text-red-600">
            ${totalValue.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {breakdown.map((item, index) => (
          <div key={item.category}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                <span className="text-sm font-medium text-slate-700">{item.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{item.count} jobs</span>
                <span className="text-sm font-semibold text-slate-900">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`${colors[index % colors.length]} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Lost value: ${item.totalValue.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Key Insights
          </h4>
          <ul className="text-sm text-amber-800 space-y-1">
            {breakdown[0] && (
              <li>
                Top reason: <span className="font-semibold">{breakdown[0].category}</span> ({breakdown[0].percentage.toFixed(0)}%)
              </li>
            )}
            {breakdown.length >= 2 && (
              <li>
                Top 2 reasons account for {(breakdown[0].percentage + breakdown[1].percentage).toFixed(0)}% of losses
              </li>
            )}
            <li>
              Average lost deal value: ${totalLost > 0 ? (totalValue / totalLost).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
