import { TaxCalculationResult } from './taxService';

export interface TaxReportData {
  taxYear: number;
  businessName: string;
  filingStatus: string;
  generatedDate: Date;
  taxCalculation: TaxCalculationResult;
  quarterlyPayments: Array<{
    quarter: number;
    amount: number;
    date: string;
  }>;
  jobs: Array<{
    date: string;
    description: string;
    revenue: number;
    expenses: number;
    netProfit: number;
  }>;
}

export function generateTaxReportCSV(data: TaxReportData): string {
  const lines: string[] = [];

  lines.push('Tax Report Summary');
  lines.push(`Tax Year,${data.taxYear}`);
  lines.push(`Business Name,${data.businessName}`);
  lines.push(`Filing Status,${data.filingStatus}`);
  lines.push(`Report Generated,${data.generatedDate.toLocaleDateString()}`);
  lines.push('');
  lines.push('');

  lines.push('Income Summary');
  lines.push('Description,Amount');
  lines.push(`Gross Income,${data.taxCalculation.grossIncome.toFixed(2)}`);
  lines.push(`Total Business Expenses,${data.taxCalculation.totalExpenses.toFixed(2)}`);
  lines.push(`Net Profit,${data.taxCalculation.netProfit.toFixed(2)}`);
  lines.push('');
  lines.push('');

  lines.push('Tax Calculations');
  lines.push('Tax Type,Amount');
  lines.push(`Self-Employment Tax,${data.taxCalculation.selfEmploymentTax.toFixed(2)}`);
  lines.push(`Self-Employment Tax Deduction (50%),${data.taxCalculation.selfEmploymentDeduction.toFixed(2)}`);
  lines.push(`Adjusted Gross Income,${data.taxCalculation.adjustedGrossIncome.toFixed(2)}`);
  lines.push(`Standard/Itemized Deduction,${data.taxCalculation.deduction.toFixed(2)}`);
  lines.push(`Taxable Income,${data.taxCalculation.taxableIncome.toFixed(2)}`);
  lines.push(`Federal Income Tax,${data.taxCalculation.federalIncomeTax.toFixed(2)}`);
  lines.push(`Total Tax Liability,${data.taxCalculation.totalTaxLiability.toFixed(2)}`);
  lines.push('');
  lines.push('');

  lines.push('Tax Rates');
  lines.push('Rate Type,Percentage');
  lines.push(`Effective Tax Rate,${data.taxCalculation.effectiveTaxRate.toFixed(2)}%`);
  lines.push(`Marginal Tax Bracket,${data.taxCalculation.marginalTaxBracket.toFixed(2)}%`);
  lines.push(`Recommended Withholding Percentage,${data.taxCalculation.recommendedWithholdingPercentage.toFixed(2)}%`);
  lines.push('');
  lines.push('');

  lines.push('Quarterly Tax Payments');
  lines.push('Quarter,Payment Date,Amount');
  data.quarterlyPayments.forEach((payment) => {
    lines.push(`Q${payment.quarter},${payment.date},${payment.amount.toFixed(2)}`);
  });
  lines.push(`Total Payments Made,,${data.quarterlyPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`);
  lines.push(`Remaining Tax Owed,,${data.taxCalculation.remainingQuarterlyPayments.toFixed(2)}`);
  lines.push('');
  lines.push('');

  lines.push('Detailed Job History');
  lines.push('Date,Description,Revenue,Expenses,Net Profit');
  data.jobs.forEach((job) => {
    const description = `"${job.description.replace(/"/g, '""')}"`;
    lines.push(`${job.date},${description},${job.revenue.toFixed(2)},${job.expenses.toFixed(2)},${job.netProfit.toFixed(2)}`);
  });
  lines.push('');
  lines.push(`Total Revenue,,${data.jobs.reduce((sum, j) => sum + j.revenue, 0).toFixed(2)},,`);
  lines.push(`Total Expenses,,${data.jobs.reduce((sum, j) => sum + j.expenses, 0).toFixed(2)},,`);
  lines.push(`Total Net Profit,,${data.jobs.reduce((sum, j) => sum + j.netProfit, 0).toFixed(2)},,`);

  return lines.join('\n');
}

export function generateScheduleCData(data: TaxReportData): string {
  const lines: string[] = [];

  lines.push('Schedule C (Form 1040) - Profit or Loss From Business');
  lines.push(`Business Name: ${data.businessName}`);
  lines.push(`Tax Year: ${data.taxYear}`);
  lines.push('');
  lines.push('');

  lines.push('PART I - INCOME');
  lines.push(`1. Gross receipts or sales,$${data.taxCalculation.grossIncome.toFixed(2)}`);
  lines.push('');

  lines.push('PART II - EXPENSES');
  lines.push('Expense Category,Amount');
  lines.push(`Materials and Supplies,$${data.taxCalculation.totalExpenses.toFixed(2)}`);
  lines.push('');
  lines.push(`Total Expenses,$${data.taxCalculation.totalExpenses.toFixed(2)}`);
  lines.push('');

  lines.push('PART III - COST OF GOODS SOLD (if applicable)');
  lines.push('Not applicable for service business');
  lines.push('');

  lines.push('PART IV - INFORMATION ON YOUR VEHICLE');
  lines.push('Complete if you are claiming car/truck expenses');
  lines.push('');

  lines.push('PART V - OTHER EXPENSES');
  lines.push('List other business expenses not included above');
  lines.push('');

  lines.push('NET PROFIT CALCULATION');
  lines.push(`Gross Income,$${data.taxCalculation.grossIncome.toFixed(2)}`);
  lines.push(`Less: Total Expenses,$${data.taxCalculation.totalExpenses.toFixed(2)}`);
  lines.push(`NET PROFIT (Loss),$${data.taxCalculation.netProfit.toFixed(2)}`);
  lines.push('');
  lines.push('Note: This is a simplified export. Consult with a tax professional for accurate Schedule C preparation.');

  return lines.join('\n');
}

export function generateScheduleSEData(data: TaxReportData): string {
  const lines: string[] = [];

  lines.push('Schedule SE (Form 1040) - Self-Employment Tax');
  lines.push(`Tax Year: ${data.taxYear}`);
  lines.push('');
  lines.push('');

  lines.push('PART I - SELF-EMPLOYMENT TAX');
  lines.push('');

  lines.push('Section A - Short Schedule SE');
  lines.push(`1. Net profit from Schedule C,$${data.taxCalculation.netProfit.toFixed(2)}`);
  lines.push(`2. Net profit subject to SE tax (92.35%),$${(data.taxCalculation.netProfit * 0.9235).toFixed(2)}`);
  lines.push('');

  lines.push('3. Self-Employment Tax Calculation:');
  lines.push(`   a. Social Security Tax (12.4%),$${data.taxCalculation.breakdown.socialSecurityTax.toFixed(2)}`);
  lines.push(`   b. Medicare Tax (2.9%),$${data.taxCalculation.breakdown.medicareTax.toFixed(2)}`);
  if (data.taxCalculation.breakdown.additionalMedicareTax > 0) {
    lines.push(`   c. Additional Medicare Tax (0.9%),$${data.taxCalculation.breakdown.additionalMedicareTax.toFixed(2)}`);
  }
  lines.push(`   Total Self-Employment Tax,$${data.taxCalculation.selfEmploymentTax.toFixed(2)}`);
  lines.push('');

  lines.push('4. Deduction for one-half of self-employment tax:');
  lines.push(`   Amount to deduct on Form 1040,$${data.taxCalculation.selfEmploymentDeduction.toFixed(2)}`);
  lines.push('');

  lines.push('IMPORTANT NOTES:');
  lines.push('- This SE tax is in addition to your federal income tax');
  lines.push('- You can deduct 50% of your SE tax when calculating AGI');
  lines.push('- Social Security tax applies only to first $168,600 of income (2024)');
  lines.push('- Additional Medicare tax applies to income over $200,000 (single) or $250,000 (married)');
  lines.push('');
  lines.push('Note: This is a simplified export. Consult with a tax professional for accurate Schedule SE preparation.');

  return lines.join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function generateTaxReportFilename(taxYear: number, reportType: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `tax-report-${reportType}-${taxYear}-${timestamp}.csv`;
}
