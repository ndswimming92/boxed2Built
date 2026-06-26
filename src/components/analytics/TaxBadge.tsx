import { Receipt } from 'lucide-react';
import { calculateJobTaxWithholding, formatCurrency } from '../../utils/taxCalculations';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface TaxBadgeProps {
  finalPrice: number | null;
  materialsCost: number | null;
  withholdingPercentage: number;
  compact?: boolean;
}

export default function TaxBadge({
  finalPrice,
  materialsCost,
  withholdingPercentage,
  compact = false,
}: TaxBadgeProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const { netProfit, recommendedWithholding, afterTaxProfit } = calculateJobTaxWithholding(
    finalPrice,
    materialsCost,
    withholdingPercentage
  );

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs">
        <Receipt className="w-3 h-3 text-amber-600" />
        <span className="text-amber-800 font-medium">
          Set aside: {maskFinancialValue(formatCurrency(recommendedWithholding))}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-2 mb-2">
        <Receipt className="w-4 h-4 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">Tax Withholding Recommendation</p>
          <p className="text-xs text-amber-700">Based on {withholdingPercentage.toFixed(1)}% withholding rate</p>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Net Profit:</span>
          <span className="font-medium text-slate-900">{maskFinancialValue(formatCurrency(netProfit))}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-amber-700">Set Aside for Taxes:</span>
          <span className="font-bold text-amber-900">{maskFinancialValue(formatCurrency(recommendedWithholding))}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-amber-200">
          <span className="text-slate-700 font-medium">After-Tax Profit:</span>
          <span className="font-bold text-emerald-600">{maskFinancialValue(formatCurrency(afterTaxProfit))}</span>
        </div>
      </div>
    </div>
  );
}
