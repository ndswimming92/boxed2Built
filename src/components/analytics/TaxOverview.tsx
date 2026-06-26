import { TaxCalculationResult } from '../../services/taxService';
import { DollarSign, TrendingUp, AlertTriangle, Calendar, Info } from 'lucide-react';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface TaxOverviewProps {
  taxCalculation: TaxCalculationResult;
  quarterlyPayments?: { quarter: number; amount: number }[];
  nextDueDate?: { quarter: number; dueDate: Date; label: string } | null;
}

export default function TaxOverview({ taxCalculation, quarterlyPayments = [], nextDueDate }: TaxOverviewProps) {
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

  const totalPaymentsMade = quarterlyPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingTaxOwed = Math.max(0, taxCalculation.totalTaxLiability - totalPaymentsMade);
  const isOnTrack = remainingTaxOwed <= taxCalculation.quarterlyEstimate * 2;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Tax Overview for Spring Hill, TN</h2>
            <p className="text-sm text-slate-600">Tennessee has no state income tax on self-employment income</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600 mb-1">Total Tax Liability</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(taxCalculation.totalTaxLiability)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-slate-600">Net Profit (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxCalculation.netProfit)}</p>
            <p className="text-xs text-slate-500 mt-1">After business expenses</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-slate-600">Effective Tax Rate</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatPercent(taxCalculation.effectiveTaxRate)}</p>
            <p className="text-xs text-slate-500 mt-1">Of gross income</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-slate-600">Marginal Tax Bracket</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatPercent(taxCalculation.marginalTaxBracket)}</p>
            <p className="text-xs text-slate-500 mt-1">On additional income</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tax Breakdown</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Federal Income Tax</p>
                <p className="text-xs text-slate-500">Based on taxable income of {formatCurrency(taxCalculation.taxableIncome)}</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(taxCalculation.federalIncomeTax)}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Self-Employment Tax</p>
                <p className="text-xs text-slate-500">Social Security + Medicare (15.3%)</p>
              </div>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(taxCalculation.selfEmploymentTax)}</p>
            </div>

            <div className="border-t border-slate-200 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Total Tax Liability</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(taxCalculation.totalTaxLiability)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mt-4">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Self-Employment Tax Deduction</p>
                <p>You can deduct {formatCurrency(taxCalculation.selfEmploymentDeduction)} (50% of SE tax) from your AGI.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Withholding Recommendations</h3>

          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">Set Aside Per Job</span>
              </div>
              <p className="text-3xl font-bold text-emerald-600 mb-2">{formatPercent(taxCalculation.recommendedWithholdingPercentage)}</p>
              <p className="text-sm text-slate-600">
                For every $100 you earn, set aside ${(taxCalculation.recommendedWithholdingPercentage).toFixed(0)} for taxes
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">Quarterly Tax Estimate</p>
              <p className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(taxCalculation.quarterlyEstimate)}</p>
              <p className="text-sm text-slate-600">Estimated payment per quarter</p>
            </div>

            {nextDueDate && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Next Payment Due</span>
                </div>
                <p className="text-lg font-bold text-amber-900 mb-1">
                  {nextDueDate.label}
                </p>
                <p className="text-sm text-amber-700">
                  Due: {nextDueDate.dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}

            <div className={`p-4 rounded-lg border ${isOnTrack ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-sm font-medium mb-1" style={{ color: isOnTrack ? '#047857' : '#dc2626' }}>
                {isOnTrack ? 'On Track' : 'Needs Attention'}
              </p>
              <p className="text-sm" style={{ color: isOnTrack ? '#065f46' : '#991b1b' }}>
                Paid: {formatCurrency(totalPaymentsMade)} / Owed: {formatCurrency(taxCalculation.totalTaxLiability)}
              </p>
              <p className="text-xs mt-1" style={{ color: isOnTrack ? '#047857' : '#dc2626' }}>
                Remaining: {formatCurrency(remainingTaxOwed)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Detailed Tax Calculation</h3>

        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Gross Income</span>
            <span className="text-right font-medium text-slate-900">{formatCurrency(taxCalculation.grossIncome)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Business Expenses</span>
            <span className="text-right font-medium text-slate-900">-{formatCurrency(taxCalculation.totalExpenses)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 bg-emerald-50 rounded font-medium">
            <span className="text-slate-700">Net Profit</span>
            <span className="text-right text-slate-900">{formatCurrency(taxCalculation.netProfit)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Self-Employment Tax Deduction (50%)</span>
            <span className="text-right font-medium text-slate-900">-{formatCurrency(taxCalculation.selfEmploymentDeduction)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Adjusted Gross Income</span>
            <span className="text-right font-medium text-slate-900">{formatCurrency(taxCalculation.adjustedGrossIncome)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Standard/Itemized Deduction</span>
            <span className="text-right font-medium text-slate-900">-{formatCurrency(taxCalculation.deduction)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 bg-blue-50 rounded font-medium">
            <span className="text-slate-700">Taxable Income</span>
            <span className="text-right text-slate-900">{formatCurrency(taxCalculation.taxableIncome)}</span>
          </div>

          <div className="border-t border-slate-200 my-3"></div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Federal Income Tax</span>
            <span className="text-right font-medium text-slate-900">{formatCurrency(taxCalculation.federalIncomeTax)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-2 hover:bg-slate-50 rounded">
            <span className="text-slate-600">Self-Employment Tax</span>
            <span className="text-right font-medium text-slate-900">{formatCurrency(taxCalculation.selfEmploymentTax)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 font-semibold text-base mt-2">
            <span className="text-slate-800">Total Tax Liability</span>
            <span className="text-right text-blue-600">{formatCurrency(taxCalculation.totalTaxLiability)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
