import React, { useState } from 'react';
import { DollarSign, TrendingUp, AlertCircle, Target } from 'lucide-react';
import { PricingRecommendation } from '../../services/analyticsService';

interface PricingInsightsCardProps {
  recommendations: PricingRecommendation[];
  defaultTargetRate?: number;
  onTargetRateChange?: (rate: number) => void;
}

export default function PricingInsightsCard({
  recommendations,
  defaultTargetRate = 50,
  onTargetRateChange
}: PricingInsightsCardProps) {
  const [targetRate, setTargetRate] = useState(defaultTargetRate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleTargetRateChange = (value: number) => {
    setTargetRate(value);
    if (onTargetRateChange) {
      onTargetRateChange(value);
    }
  };

  const getPriceAdjustmentColor = (adjustment: number) => {
    const absAdjustment = Math.abs(adjustment);
    if (absAdjustment > 30) return 'text-red-600';
    if (absAdjustment > 15) return 'text-amber-600';
    if (absAdjustment > 5) return 'text-blue-600';
    return 'text-emerald-600';
  };

  const getPriceAdjustmentBg = (adjustment: number) => {
    const absAdjustment = Math.abs(adjustment);
    if (absAdjustment > 30) return 'bg-red-50 border-red-200';
    if (absAdjustment > 15) return 'bg-amber-50 border-amber-200';
    if (absAdjustment > 5) return 'bg-blue-50 border-blue-200';
    return 'bg-emerald-50 border-emerald-200';
  };

  const getRecommendationText = (adjustment: number) => {
    if (adjustment > 30) return 'Significant price increase needed';
    if (adjustment > 15) return 'Moderate price increase recommended';
    if (adjustment > 5) return 'Small price adjustment suggested';
    if (adjustment > -5) return 'Pricing on target';
    if (adjustment > -15) return 'Consider maintaining or slightly reducing';
    return 'Well above target rate';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-blue-50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Pricing Intelligence</h3>
              <p className="text-sm text-slate-600">Data-driven pricing recommendations by job type</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="targetRate" className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Target Rate:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                id="targetRate"
                type="number"
                min="20"
                max="200"
                step="5"
                value={targetRate}
                onChange={(e) => handleTargetRateChange(Number(e.target.value))}
                className="w-24 pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">/hr</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.jobType}
                className={`p-4 rounded-lg border ${getPriceAdjustmentBg(rec.priceAdjustmentNeeded)}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{rec.jobType}</h4>
                      <span className="text-xs text-slate-500">({rec.sampleSize} jobs)</span>
                    </div>
                    <p className="text-sm text-slate-600">{getRecommendationText(rec.priceAdjustmentNeeded)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.priceAdjustmentNeeded > 5 ? (
                      <TrendingUp className={`w-5 h-5 ${getPriceAdjustmentColor(rec.priceAdjustmentNeeded)}`} />
                    ) : rec.priceAdjustmentNeeded < -5 ? (
                      <Target className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                    )}
                    <span className={`text-lg font-bold ${getPriceAdjustmentColor(rec.priceAdjustmentNeeded)}`}>
                      {rec.priceAdjustmentNeeded > 0 ? '+' : ''}
                      {rec.priceAdjustmentNeeded.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Current Pricing</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-700">Range:</span>
                        <span className="text-sm text-slate-600">
                          {formatCurrency(rec.minPrice)} - {formatCurrency(rec.maxPrice)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-700">Average:</span>
                        <span className="text-sm text-slate-900 font-semibold">{formatCurrency(rec.avgPrice)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Current Hourly Rate</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrency(rec.currentAvgHourlyRate)}/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Recommended Pricing</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-700">Range:</span>
                        <span className="text-sm text-teal-600 font-semibold">
                          {formatCurrency(rec.recommendedMin)} - {formatCurrency(rec.recommendedMax)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-700">Target:</span>
                        <span className="text-sm text-teal-900 font-semibold">
                          {formatCurrency((rec.recommendedMin + rec.recommendedMax) / 2)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Target Hourly Rate</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-teal-600">
                          {formatCurrency(rec.targetHourlyRate)}/hr
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {Math.abs(rec.priceAdjustmentNeeded) > 5 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600">
                        {rec.priceAdjustmentNeeded > 0 ? (
                          <>
                            To reach your target hourly rate of {formatCurrency(rec.targetHourlyRate)}/hr, consider
                            increasing prices by approximately {formatCurrency((rec.recommendedMin + rec.recommendedMax) / 2 - rec.avgPrice)}.
                          </>
                        ) : (
                          <>
                            Your current rates exceed the target hourly rate. You have pricing power in this category.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2">No pricing recommendations available yet</p>
            <p className="text-sm text-slate-500">
              Complete at least 3 jobs per job type to see pricing insights
            </p>
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">How to Use These Recommendations:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>Adjust target hourly rate based on your business goals</li>
                <li>Focus on job types with the largest pricing gaps first</li>
                <li>Test price increases gradually with new clients</li>
                <li>Consider market conditions and competition in your area</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
