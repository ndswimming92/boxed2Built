import { TrendingUp, TrendingDown } from 'lucide-react';
import { ConversionMetrics } from '../../services/analyticsService';

interface ConversionFunnelChartProps {
  metrics: ConversionMetrics;
}

export default function ConversionFunnelChart({ metrics }: ConversionFunnelChartProps) {
  const funnelStages = [
    { label: 'Quoted', count: metrics.quotedJobs, color: 'bg-amber-500', width: 100 },
    { label: 'Accepted', count: metrics.acceptedJobs, color: 'bg-blue-500', width: 80 },
    { label: 'Scheduled', count: metrics.scheduledJobs, color: 'bg-sky-500', width: 60 },
    { label: 'In Progress', count: metrics.inProgressJobs, color: 'bg-teal-500', width: 40 },
    { label: 'Completed', count: metrics.completedJobs, color: 'bg-emerald-500', width: 20 },
  ];

  const maxCount = Math.max(...funnelStages.map(s => s.count), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Sales Funnel</h3>
        <p className="text-sm text-slate-600">Job progression through pipeline stages</p>
      </div>

      <div className="space-y-3 mb-6">
        {funnelStages.map((stage, index) => {
          const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const nextStage = funnelStages[index + 1];
          const dropoffRate = nextStage && stage.count > 0
            ? ((stage.count - nextStage.count) / stage.count) * 100
            : 0;

          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">{stage.label}</span>
                <span className="text-sm font-semibold text-slate-900">{stage.count}</span>
              </div>
              <div className="relative">
                <div className="w-full bg-slate-100 rounded-lg h-12 overflow-hidden">
                  <div
                    className={`${stage.color} h-full rounded-lg transition-all duration-500 flex items-center justify-end px-3`}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && (
                      <span className="text-white font-semibold text-sm">
                        {stage.count > 0 ? `${((stage.count / metrics.totalOpportunities) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {nextStage && dropoffRate > 0 && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <TrendingDown className="w-3 h-3" />
                  <span>{dropoffRate.toFixed(0)}% drop-off to {nextStage.label.toLowerCase()}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span className="text-xs font-medium text-slate-600">Lost</span>
          </div>
          <div className="text-2xl font-bold text-slate-700">{metrics.lostJobs}</div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.lossRate.toFixed(1)}% of total
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-rose-400"></div>
            <span className="text-xs font-medium text-slate-600">Cancelled</span>
          </div>
          <div className="text-2xl font-bold text-slate-700">{metrics.cancelledJobs}</div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.cancellationRate.toFixed(1)}% of total
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="text-xs font-medium text-emerald-700 mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
              {metrics.winRate.toFixed(1)}%
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs font-medium text-blue-700 mb-1">Quote to Close</div>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.quoteToCompleteRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
