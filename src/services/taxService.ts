import { supabase } from '../lib/supabase';

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

export interface TaxSettings {
  id: string;
  business_id: string;
  filing_status: FilingStatus;
  use_standard_deduction: boolean;
  estimated_itemized_deductions: number;
  estimated_annual_business_expenses: number;
  q1_payment_goal: number;
  q2_payment_goal: number;
  q3_payment_goal: number;
  q4_payment_goal: number;
  include_health_insurance_deduction: boolean;
  health_insurance_annual_cost: number;
  include_retirement_contributions: boolean;
  retirement_contribution_annual: number;
  state: string;
  tax_year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyTaxPayment {
  id: string;
  business_id: string;
  tax_year: number;
  quarter: number;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
  confirmation_number: string | null;
  federal_income_tax_amount: number;
  self_employment_tax_amount: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxCalculation {
  id: string;
  business_id: string;
  calculation_date: string;
  tax_year: number;
  quarter: number | null;
  gross_income: number;
  total_expenses: number;
  net_profit: number;
  self_employment_tax: number;
  self_employment_deduction: number;
  adjusted_gross_income: number;
  standard_or_itemized_deduction: number;
  taxable_income: number;
  federal_income_tax: number;
  total_tax_liability: number;
  quarterly_payments_made: number;
  estimated_tax_remaining: number;
  effective_tax_rate: number;
  marginal_tax_bracket: number;
  recommended_withholding_percentage: number;
  calculation_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxBracket {
  rate: number;
  min: number;
  max: number | null;
}

export interface TaxCalculationResult {
  grossIncome: number;
  totalExpenses: number;
  netProfit: number;

  selfEmploymentTax: number;
  selfEmploymentDeduction: number;
  adjustedGrossIncome: number;

  deduction: number;
  taxableIncome: number;

  federalIncomeTax: number;
  totalTaxLiability: number;

  effectiveTaxRate: number;
  marginalTaxBracket: number;

  recommendedWithholdingPercentage: number;
  amountToSetAsidePerJob: number;

  quarterlyEstimate: number;
  remainingQuarterlyPayments: number;

  breakdown: {
    socialSecurityTax: number;
    medicareTax: number;
    additionalMedicareTax: number;
    federalIncomeTax: number;
  };
}

const TAX_YEAR = 2024;

const FEDERAL_TAX_BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.10, min: 0, max: 11600 },
    { rate: 0.12, min: 11600, max: 47150 },
    { rate: 0.22, min: 47150, max: 100525 },
    { rate: 0.24, min: 100525, max: 191950 },
    { rate: 0.32, min: 191950, max: 243725 },
    { rate: 0.35, min: 243725, max: 609350 },
    { rate: 0.37, min: 609350, max: null },
  ],
  married_joint: [
    { rate: 0.10, min: 0, max: 23200 },
    { rate: 0.12, min: 23200, max: 94300 },
    { rate: 0.22, min: 94300, max: 201050 },
    { rate: 0.24, min: 201050, max: 383900 },
    { rate: 0.32, min: 383900, max: 487450 },
    { rate: 0.35, min: 487450, max: 731200 },
    { rate: 0.37, min: 731200, max: null },
  ],
  married_separate: [
    { rate: 0.10, min: 0, max: 11600 },
    { rate: 0.12, min: 11600, max: 47150 },
    { rate: 0.22, min: 47150, max: 100525 },
    { rate: 0.24, min: 100525, max: 191950 },
    { rate: 0.32, min: 191950, max: 243725 },
    { rate: 0.35, min: 243725, max: 365600 },
    { rate: 0.37, min: 365600, max: null },
  ],
  head_of_household: [
    { rate: 0.10, min: 0, max: 16550 },
    { rate: 0.12, min: 16550, max: 63100 },
    { rate: 0.22, min: 63100, max: 100500 },
    { rate: 0.24, min: 100500, max: 191950 },
    { rate: 0.32, min: 191950, max: 243700 },
    { rate: 0.35, min: 243700, max: 609350 },
    { rate: 0.37, min: 609350, max: null },
  ],
};

export const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14600,
  married_joint: 29200,
  married_separate: 14600,
  head_of_household: 21900,
};

const SOCIAL_SECURITY_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const SELF_EMPLOYMENT_TAX_RATE = SOCIAL_SECURITY_RATE + MEDICARE_RATE;
const SELF_EMPLOYMENT_INCOME_SUBJECT_TO_TAX = 0.9235;

const SOCIAL_SECURITY_WAGE_BASE_2024 = 168600;
const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200000;
const ADDITIONAL_MEDICARE_THRESHOLD_MARRIED_JOINT = 250000;
const ADDITIONAL_MEDICARE_THRESHOLD_MARRIED_SEPARATE = 125000;
const ADDITIONAL_MEDICARE_RATE = 0.009;

export function calculateFederalIncomeTax(taxableIncome: number, filingStatus: FilingStatus): number {
  if (taxableIncome <= 0) return 0;

  const brackets = FEDERAL_TAX_BRACKETS_2024[filingStatus];
  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    const nextBracket = brackets[i + 1];

    const bracketMax = bracket.max || Infinity;
    const incomeInBracket = Math.min(remainingIncome, bracketMax - bracket.min);

    if (incomeInBracket > 0) {
      totalTax += incomeInBracket * bracket.rate;
      remainingIncome -= incomeInBracket;
    }

    if (remainingIncome <= 0 || !nextBracket) break;
  }

  return Math.round(totalTax * 100) / 100;
}

export function getMarginalTaxBracket(taxableIncome: number, filingStatus: FilingStatus): number {
  if (taxableIncome <= 0) return 0;

  const brackets = FEDERAL_TAX_BRACKETS_2024[filingStatus];

  for (const bracket of brackets) {
    if (bracket.max === null || taxableIncome <= bracket.max) {
      return bracket.rate * 100;
    }
  }

  return brackets[brackets.length - 1].rate * 100;
}

export function calculateSelfEmploymentTax(netProfit: number, filingStatus: FilingStatus): {
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalSelfEmploymentTax: number;
} {
  if (netProfit <= 0) {
    return {
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      totalSelfEmploymentTax: 0,
    };
  }

  const selfEmploymentIncome = netProfit * SELF_EMPLOYMENT_INCOME_SUBJECT_TO_TAX;

  const socialSecurityTax = Math.min(selfEmploymentIncome, SOCIAL_SECURITY_WAGE_BASE_2024) * SOCIAL_SECURITY_RATE;

  const medicareTax = selfEmploymentIncome * MEDICARE_RATE;

  let additionalMedicareThreshold = ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  if (filingStatus === 'married_joint') {
    additionalMedicareThreshold = ADDITIONAL_MEDICARE_THRESHOLD_MARRIED_JOINT;
  } else if (filingStatus === 'married_separate') {
    additionalMedicareThreshold = ADDITIONAL_MEDICARE_THRESHOLD_MARRIED_SEPARATE;
  } else if (filingStatus === 'head_of_household') {
    additionalMedicareThreshold = ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  }

  const additionalMedicareTax = selfEmploymentIncome > additionalMedicareThreshold
    ? (selfEmploymentIncome - additionalMedicareThreshold) * ADDITIONAL_MEDICARE_RATE
    : 0;

  const totalSelfEmploymentTax = socialSecurityTax + medicareTax + additionalMedicareTax;

  return {
    socialSecurityTax: Math.round(socialSecurityTax * 100) / 100,
    medicareTax: Math.round(medicareTax * 100) / 100,
    additionalMedicareTax: Math.round(additionalMedicareTax * 100) / 100,
    totalSelfEmploymentTax: Math.round(totalSelfEmploymentTax * 100) / 100,
  };
}

export function calculateTaxes(
  grossIncome: number,
  totalExpenses: number,
  settings: Partial<TaxSettings>,
  quarterlyPaymentsMade: number = 0
): TaxCalculationResult {
  const filingStatus = settings.filing_status || 'single';
  const netProfit = Math.max(0, grossIncome - totalExpenses);

  const seIncome = netProfit * SELF_EMPLOYMENT_INCOME_SUBJECT_TO_TAX;
  const seTaxBreakdown = calculateSelfEmploymentTax(netProfit, filingStatus);
  const selfEmploymentTax = seTaxBreakdown.totalSelfEmploymentTax;

  const selfEmploymentDeduction = selfEmploymentTax * 0.5;

  let adjustedGrossIncome = netProfit - selfEmploymentDeduction;

  if (settings.include_health_insurance_deduction && settings.health_insurance_annual_cost) {
    adjustedGrossIncome -= settings.health_insurance_annual_cost;
  }

  if (settings.include_retirement_contributions && settings.retirement_contribution_annual) {
    adjustedGrossIncome -= settings.retirement_contribution_annual;
  }

  const deduction = settings.use_standard_deduction
    ? STANDARD_DEDUCTION_2024[filingStatus]
    : (settings.estimated_itemized_deductions || 0);

  const taxableIncome = Math.max(0, adjustedGrossIncome - deduction);

  const federalIncomeTax = calculateFederalIncomeTax(taxableIncome, filingStatus);

  const totalTaxLiability = selfEmploymentTax + federalIncomeTax;

  const effectiveTaxRate = grossIncome > 0 ? (totalTaxLiability / grossIncome) * 100 : 0;

  const marginalTaxBracket = getMarginalTaxBracket(taxableIncome, filingStatus);

  const marginalRate = marginalTaxBracket / 100;
  const seRate = SELF_EMPLOYMENT_TAX_RATE * SELF_EMPLOYMENT_INCOME_SUBJECT_TO_TAX;
  const recommendedWithholdingPercentage = ((marginalRate + seRate) * 100);

  const quarterlyEstimate = totalTaxLiability / 4;
  const remainingQuarterlyPayments = Math.max(0, totalTaxLiability - quarterlyPaymentsMade);

  return {
    grossIncome: Math.round(grossIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,

    selfEmploymentTax: Math.round(selfEmploymentTax * 100) / 100,
    selfEmploymentDeduction: Math.round(selfEmploymentDeduction * 100) / 100,
    adjustedGrossIncome: Math.round(adjustedGrossIncome * 100) / 100,

    deduction: Math.round(deduction * 100) / 100,
    taxableIncome: Math.round(taxableIncome * 100) / 100,

    federalIncomeTax: Math.round(federalIncomeTax * 100) / 100,
    totalTaxLiability: Math.round(totalTaxLiability * 100) / 100,

    effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
    marginalTaxBracket: Math.round(marginalTaxBracket * 100) / 100,

    recommendedWithholdingPercentage: Math.round(recommendedWithholdingPercentage * 100) / 100,
    amountToSetAsidePerJob: 0,

    quarterlyEstimate: Math.round(quarterlyEstimate * 100) / 100,
    remainingQuarterlyPayments: Math.round(remainingQuarterlyPayments * 100) / 100,

    breakdown: {
      socialSecurityTax: seTaxBreakdown.socialSecurityTax,
      medicareTax: seTaxBreakdown.medicareTax,
      additionalMedicareTax: seTaxBreakdown.additionalMedicareTax,
      federalIncomeTax: Math.round(federalIncomeTax * 100) / 100,
    },
  };
}

export async function getTaxSettings(businessId: string, taxYear?: number): Promise<TaxSettings | null> {
  const year = taxYear || new Date().getFullYear();

  const { data, error } = await supabase
    .from('tax_settings')
    .select('*')
    .eq('business_id', businessId)
    .eq('tax_year', year)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching tax settings:', error);
    return null;
  }

  return data;
}

export async function upsertTaxSettings(settings: Partial<TaxSettings> & { business_id: string }): Promise<TaxSettings | null> {
  const { data, error } = await supabase
    .from('tax_settings')
    .upsert(settings, {
      onConflict: 'business_id,tax_year,is_active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting tax settings:', error);
    return null;
  }

  return data;
}

export async function getQuarterlyPayments(
  businessId: string,
  taxYear?: number
): Promise<QuarterlyTaxPayment[]> {
  const year = taxYear || new Date().getFullYear();

  const { data, error } = await supabase
    .from('quarterly_tax_payments')
    .select('*')
    .eq('business_id', businessId)
    .eq('tax_year', year)
    .eq('is_active', true)
    .order('quarter', { ascending: true });

  if (error) {
    console.error('Error fetching quarterly payments:', error);
    return [];
  }

  return data || [];
}

export async function addQuarterlyPayment(
  payment: Omit<QuarterlyTaxPayment, 'id' | 'created_at' | 'updated_at' | 'is_active'>
): Promise<QuarterlyTaxPayment | null> {
  const { data, error } = await supabase
    .from('quarterly_tax_payments')
    .insert(payment)
    .select()
    .single();

  if (error) {
    console.error('Error adding quarterly payment:', error);
    return null;
  }

  return data;
}

export async function saveTaxCalculation(
  calculation: Omit<TaxCalculation, 'id' | 'created_at' | 'updated_at' | 'is_active'>
): Promise<TaxCalculation | null> {
  const { data, error } = await supabase
    .from('tax_calculations')
    .insert(calculation)
    .select()
    .single();

  if (error) {
    console.error('Error saving tax calculation:', error);
    return null;
  }

  return data;
}

export async function getRecentTaxCalculations(
  businessId: string,
  limit: number = 10
): Promise<TaxCalculation[]> {
  const { data, error } = await supabase
    .from('tax_calculations')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('calculation_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching tax calculations:', error);
    return [];
  }

  return data || [];
}

export function getQuarterDueDates(taxYear: number): { quarter: number; dueDate: Date; label: string }[] {
  return [
    {
      quarter: 1,
      dueDate: new Date(taxYear, 3, 15),
      label: 'Q1 (Jan-Mar)',
    },
    {
      quarter: 2,
      dueDate: new Date(taxYear, 5, 15),
      label: 'Q2 (Apr-May)',
    },
    {
      quarter: 3,
      dueDate: new Date(taxYear, 8, 15),
      label: 'Q3 (Jun-Aug)',
    },
    {
      quarter: 4,
      dueDate: new Date(taxYear + 1, 0, 15),
      label: 'Q4 (Sep-Dec)',
    },
  ];
}

export function getCurrentQuarter(): number {
  const month = new Date().getMonth() + 1;

  if (month <= 3) return 1;
  if (month <= 5) return 2;
  if (month <= 8) return 3;
  return 4;
}

export function getNextQuarterDueDate(): { quarter: number; dueDate: Date; label: string } | null {
  const currentYear = new Date().getFullYear();
  const quarters = getQuarterDueDates(currentYear);
  const today = new Date();

  for (const quarter of quarters) {
    if (quarter.dueDate > today) {
      return quarter;
    }
  }

  return quarters[0];
}
