import { Target, DollarSign, TrendingUp, Clock, AlertCircle, XCircle } from 'lucide-react';
import { ConversionMetrics } from '../../services/analyticsService';

interface ConversionMetricsCardsProps {
  metrics: ConversionMetrics;
}

export default function ConversionMetricsCards({ metrics }: ConversionMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Total Opportunities</div>
        </div>
        <div className="text-2xl font-bold text-slate-900">{metrics.totalOpportunities}</div>
        <div className="text-xs text-slate-500 mt-1">All quoted jobs</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Win Rate</div>
        </div>
        <div className="text-2xl font-bold text-emerald-600">{metrics.winRate.toFixed(1)}%</div>
        <div className="text-xs text-slate-500 mt-1">
          Won vs lost deals
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Target className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Quote to Close</div>
        </div>
        <div className="text-2xl font-bold text-teal-600">{metrics.quoteToCompleteRate.toFixed(1)}%</div>
        <div className="text-xs text-slate-500 mt-1">
          Overall conversion
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Pipeline Value</div>
        </div>
        <div className="text-2xl font-bold text-blue-600">
          ${(metrics.activePipelineValue / 1000).toFixed(1)}k
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Active opportunities
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Lost Value</div>
        </div>
        <div className="text-2xl font-bold text-red-600">
          ${(metrics.lostOpportunityValue / 1000).toFixed(1)}k
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {metrics.lostJobs} lost deals
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-xs font-medium text-slate-600">Avg Days to Close</div>
        </div>
        <div className="text-2xl font-bold text-amber-600">
          {metrics.avgDaysToComplete.toFixed(0)}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Quote to completion
        </div>
      </div>
    </div>
  );
}
