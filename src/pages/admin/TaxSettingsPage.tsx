import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  getTaxSettings,
  upsertTaxSettings,
  FilingStatus,
  TaxSettings,
  STANDARD_DEDUCTION_2024,
} from '../../services/taxService';
import { DollarSign, Settings, Save, Info } from 'lucide-react';

export default function TaxSettingsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [useStandardDeduction, setUseStandardDeduction] = useState(true);
  const [estimatedItemizedDeductions, setEstimatedItemizedDeductions] = useState(0);
  const [estimatedAnnualBusinessExpenses, setEstimatedAnnualBusinessExpenses] = useState(0);

  const [q1PaymentGoal, setQ1PaymentGoal] = useState(0);
  const [q2PaymentGoal, setQ2PaymentGoal] = useState(0);
  const [q3PaymentGoal, setQ3PaymentGoal] = useState(0);
  const [q4PaymentGoal, setQ4PaymentGoal] = useState(0);

  const [includeHealthInsurance, setIncludeHealthInsurance] = useState(false);
  const [healthInsuranceAnnualCost, setHealthInsuranceAnnualCost] = useState(0);

  const [includeRetirement, setIncludeRetirement] = useState(false);
  const [retirementContributionAnnual, setRetirementContributionAnnual] = useState(0);

  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: bizData } = await supabase
      .from('business_info')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (bizData) {
      setBusinessId(bizData.id);

      const settings = await getTaxSettings(bizData.id);
      if (settings) {
        loadSettings(settings);
      }
    }

    setLoading(false);
  };

  const loadSettings = (settings: TaxSettings) => {
    setFilingStatus(settings.filing_status);
    setUseStandardDeduction(settings.use_standard_deduction);
    setEstimatedItemizedDeductions(settings.estimated_itemized_deductions);
    setEstimatedAnnualBusinessExpenses(settings.estimated_annual_business_expenses);
    setQ1PaymentGoal(settings.q1_payment_goal);
    setQ2PaymentGoal(settings.q2_payment_goal);
    setQ3PaymentGoal(settings.q3_payment_goal);
    setQ4PaymentGoal(settings.q4_payment_goal);
    setIncludeHealthInsurance(settings.include_health_insurance_deduction);
    setHealthInsuranceAnnualCost(settings.health_insurance_annual_cost);
    setIncludeRetirement(settings.include_retirement_contributions);
    setRetirementContributionAnnual(settings.retirement_contribution_annual);
    setTaxYear(settings.tax_year);
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setMessage(null);

    const settings = {
      business_id: businessId,
      filing_status: filingStatus,
      use_standard_deduction: useStandardDeduction,
      estimated_itemized_deductions: estimatedItemizedDeductions,
      estimated_annual_business_expenses: estimatedAnnualBusinessExpenses,
      q1_payment_goal: q1PaymentGoal,
      q2_payment_goal: q2PaymentGoal,
      q3_payment_goal: q3PaymentGoal,
      q4_payment_goal: q4PaymentGoal,
      include_health_insurance_deduction: includeHealthInsurance,
      health_insurance_annual_cost: healthInsuranceAnnualCost,
      include_retirement_contributions: includeRetirement,
      retirement_contribution_annual: retirementContributionAnnual,
      state: 'TN',
      tax_year: taxYear,
      is_active: true,
    };

    const result = await upsertTaxSettings(settings);

    if (result) {
      setMessage({ type: 'success', text: 'Tax settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: 'Failed to save tax settings. Please try again.' });
    }

    setSaving(false);
  };

  const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Tax Settings</h1>
        </div>
        <p className="text-sm sm:text-base text-slate-600">
          Configure your tax information for Spring Hill, TN. Tennessee has no state income tax on self-employment income.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Basic Tax Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tax Year</label>
              <select name="taxYear"
                value={taxYear}
                onChange={(e) => setTaxYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Filing Status</label>
              <select name="filingStatus"
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_of_household">Head of Household</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Standard Deduction for {filingStatus === 'single' ? 'Single' : filingStatus === 'married_joint' ? 'Married Filing Jointly' : filingStatus === 'married_separate' ? 'Married Filing Separately' : 'Head of Household'}: ${standardDeduction.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Deductions</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Standard vs Itemized Deductions</p>
                <p>
                  Most taxpayers benefit from the standard deduction. Only itemize if your deductible expenses
                  (mortgage interest, property taxes, charitable donations, etc.) exceed the standard deduction.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useStandardDeduction"
                checked={useStandardDeduction}
                onChange={(e) => setUseStandardDeduction(e.target.checked)}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="useStandardDeduction" className="text-sm font-medium text-slate-700">
                Use Standard Deduction (${standardDeduction.toLocaleString()})
              </label>
            </div>

            {!useStandardDeduction && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estimated Itemized Deductions
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input name="estimatedItemizedDeductions"
                    type="number"
                    value={estimatedItemizedDeductions}
                    onChange={(e) => setEstimatedItemizedDeductions(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0"
                    min="0"
                    step="100"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Estimated Annual Business Expenses
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="estimatedAnnualBusinessExpenses"
                  type="number"
                  value={estimatedAnnualBusinessExpenses}
                  onChange={(e) => setEstimatedAnnualBusinessExpenses(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gas, tools, marketing, insurance, etc. (excluding materials costs tracked per job)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Additional Deductions</h2>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="includeHealthInsurance"
                  checked={includeHealthInsurance}
                  onChange={(e) => setIncludeHealthInsurance(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="includeHealthInsurance" className="text-sm font-medium text-slate-700">
                  Self-Employed Health Insurance Deduction
                </label>
              </div>

              {includeHealthInsurance && (
                <div className="ml-8">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Annual Health Insurance Cost
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input name="healthInsuranceAnnualCost"
                      type="number"
                      value={healthInsuranceAnnualCost}
                      onChange={(e) => setHealthInsuranceAnnualCost(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="includeRetirement"
                  checked={includeRetirement}
                  onChange={(e) => setIncludeRetirement(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="includeRetirement" className="text-sm font-medium text-slate-700">
                  Self-Employed Retirement Contributions (SEP IRA, Solo 401k)
                </label>
              </div>

              {includeRetirement && (
                <div className="ml-8">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Annual Retirement Contribution
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input name="retirementContributionAnnual"
                      type="number"
                      value={retirementContributionAnnual}
                      onChange={(e) => setRetirementContributionAnnual(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0"
                      min="0"
                      step="500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Quarterly Tax Payment Goals</h2>
          <p className="text-sm text-slate-600 mb-4">
            Set payment goals for each quarter. These help you track progress toward meeting your tax obligations.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Q1 Goal (Due Apr 15)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="q1PaymentGoal"
                  type="number"
                  value={q1PaymentGoal}
                  onChange={(e) => setQ1PaymentGoal(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Q2 Goal (Due Jun 15)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="q2PaymentGoal"
                  type="number"
                  value={q2PaymentGoal}
                  onChange={(e) => setQ2PaymentGoal(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Q3 Goal (Due Sep 15)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="q3PaymentGoal"
                  type="number"
                  value={q3PaymentGoal}
                  onChange={(e) => setQ3PaymentGoal(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Q4 Goal (Due Jan 15)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="q4PaymentGoal"
                  type="number"
                  value={q4PaymentGoal}
                  onChange={(e) => setQ4PaymentGoal(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
