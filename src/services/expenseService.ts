import { supabase } from '../lib/supabase';

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  irs_category: string | null;
  is_tax_deductible: boolean;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessExpense {
  id: string;
  business_id: string;
  category_id: string | null;
  expense_date: string;
  vendor_name: string;
  description: string;
  amount: number;
  payment_method: string | null;
  confirmation_number: string | null;
  is_tax_deductible: boolean;
  deductible_amount: number | null;
  tax_year: number;
  quarter: number | null;
  receipt_url: string | null;
  has_receipt: boolean;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  tags: string[] | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends BusinessExpense {
  category?: ExpenseCategory | null;
}

export interface ExpenseStats {
  totalExpenses: number;
  deductibleExpenses: number;
  nonDeductibleExpenses: number;
  expenseCount: number;
  avgExpenseAmount: number;
  topCategory: string | null;
  topCategoryAmount: number;
}

export interface ExpenseByCategoryStats {
  category_id: string;
  category_name: string;
  total_amount: number;
  deductible_amount: number;
  expense_count: number;
  percentage_of_total: number;
  [key: string]: string | number;
}

export async function getExpenseCategories(businessId: string): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching expense categories:', error);
    return [];
  }

  return data || [];
}

export async function createExpenseCategory(category: Partial<ExpenseCategory>): Promise<ExpenseCategory | null> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert([category])
    .select()
    .single();

  if (error) {
    console.error('Error creating expense category:', error);
    return null;
  }

  return data;
}

export async function getExpenses(
  businessId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    taxYear?: number;
    quarter?: number;
    isDeductible?: boolean;
  }
): Promise<ExpenseWithCategory[]> {
  let query = supabase
    .from('business_expenses')
    .select(`
      *,
      category:expense_categories(*)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('expense_date', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('expense_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('expense_date', filters.endDate);
  }

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters?.taxYear) {
    query = query.eq('tax_year', filters.taxYear);
  }

  if (filters?.quarter) {
    query = query.eq('quarter', filters.quarter);
  }

  if (filters?.isDeductible !== undefined) {
    query = query.eq('is_tax_deductible', filters.isDeductible);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }

  return data || [];
}

export async function createExpense(expense: Partial<BusinessExpense>): Promise<BusinessExpense | null> {
  const { data, error } = await supabase
    .from('business_expenses')
    .insert([expense])
    .select()
    .single();

  if (error) {
    console.error('Error creating expense:', error);
    return null;
  }

  return data;
}

export async function updateExpense(id: string, updates: Partial<BusinessExpense>): Promise<BusinessExpense | null> {
  const { data, error } = await supabase
    .from('business_expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating expense:', error);
    return null;
  }

  return data;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('business_expenses')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting expense:', error);
    return false;
  }

  return true;
}

export async function getExpenseStats(
  businessId: string,
  taxYear?: number
): Promise<ExpenseStats> {
  let query = supabase
    .from('business_expenses')
    .select('amount, deductible_amount, is_tax_deductible, category_id')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (taxYear) {
    query = query.eq('tax_year', taxYear);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      totalExpenses: 0,
      deductibleExpenses: 0,
      nonDeductibleExpenses: 0,
      expenseCount: 0,
      avgExpenseAmount: 0,
      topCategory: null,
      topCategoryAmount: 0,
    };
  }

  const totalExpenses = data.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const deductibleExpenses = data.reduce((sum, exp) => sum + (exp.deductible_amount || 0), 0);
  const nonDeductibleExpenses = totalExpenses - deductibleExpenses;
  const expenseCount = data.length;
  const avgExpenseAmount = totalExpenses / expenseCount;

  const categoryTotals: Record<string, number> = {};
  data.forEach(exp => {
    if (exp.category_id) {
      categoryTotals[exp.category_id] = (categoryTotals[exp.category_id] || 0) + exp.amount;
    }
  });

  let topCategory: string | null = null;
  let topCategoryAmount = 0;
  Object.entries(categoryTotals).forEach(([catId, amount]) => {
    if (amount > topCategoryAmount) {
      topCategory = catId;
      topCategoryAmount = amount;
    }
  });

  return {
    totalExpenses,
    deductibleExpenses,
    nonDeductibleExpenses,
    expenseCount,
    avgExpenseAmount,
    topCategory,
    topCategoryAmount,
  };
}

export async function getExpensesByCategory(
  businessId: string,
  taxYear?: number
): Promise<ExpenseByCategoryStats[]> {
  let query = supabase
    .from('business_expenses')
    .select(`
      amount,
      deductible_amount,
      category_id,
      category:expense_categories(name)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (taxYear) {
    query = query.eq('tax_year', taxYear);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const categoryMap: Record<string, { name: string; total: number; deductible: number; count: number }> = {};
  let grandTotal = 0;

  data.forEach(exp => {
    const catId = exp.category_id || 'uncategorized';
    const catName = (exp.category as unknown as { name?: string } | null)?.name || 'Uncategorized';

    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        name: catName,
        total: 0,
        deductible: 0,
        count: 0,
      };
    }

    categoryMap[catId].total += exp.amount || 0;
    categoryMap[catId].deductible += exp.deductible_amount || 0;
    categoryMap[catId].count += 1;
    grandTotal += exp.amount || 0;
  });

  return Object.entries(categoryMap).map(([catId, stats]) => ({
    category_id: catId,
    category_name: stats.name,
    total_amount: stats.total,
    deductible_amount: stats.deductible,
    expense_count: stats.count,
    percentage_of_total: grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0,
  })).sort((a, b) => b.total_amount - a.total_amount);
}

export async function getTotalDeductibleExpenses(
  businessId: string,
  taxYear: number
): Promise<number> {
  const { data, error } = await supabase
    .from('business_expenses')
    .select('deductible_amount')
    .eq('business_id', businessId)
    .eq('tax_year', taxYear)
    .eq('is_active', true);

  if (error || !data) {
    console.error('Error fetching total deductible expenses:', error);
    return 0;
  }

  return data.reduce((sum, exp) => sum + (exp.deductible_amount || 0), 0);
}

export async function getMonthlyExpenses(
  businessId: string,
  year: number
): Promise<Array<{ month: string; amount: number; deductible: number }>> {
  const { data, error } = await supabase
    .from('business_expenses')
    .select('expense_date, amount, deductible_amount')
    .eq('business_id', businessId)
    .eq('tax_year', year)
    .eq('is_active', true)
    .order('expense_date', { ascending: true });

  if (error || !data) {
    return [];
  }

  const monthlyData: Record<string, { amount: number; deductible: number }> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  monthNames.forEach((month, _index) => {
    monthlyData[month] = { amount: 0, deductible: 0 };
  });

  data.forEach(exp => {
    const date = new Date(exp.expense_date);
    const monthIndex = date.getMonth();
    const monthName = monthNames[monthIndex];

    monthlyData[monthName].amount += exp.amount || 0;
    monthlyData[monthName].deductible += exp.deductible_amount || 0;
  });

  return monthNames.map(month => ({
    month,
    amount: monthlyData[month].amount,
    deductible: monthlyData[month].deductible,
  }));
}

export async function uploadReceiptToStorage(
  businessId: string,
  expenseId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${businessId}/${expenseId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('expense-receipts')
    .upload(fileName, file);

  if (error) {
    console.error('Error uploading receipt:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('expense-receipts')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export function exportExpensesToCSV(expenses: ExpenseWithCategory[]): string {
  const headers = [
    'Date',
    'Vendor',
    'Description',
    'Category',
    'Amount',
    'Deductible Amount',
    'Tax Deductible',
    'Payment Method',
    'Confirmation Number',
    'Tax Year',
    'Quarter',
    'Has Receipt',
    'Notes'
  ];

  const rows = expenses.map(exp => [
    exp.expense_date,
    exp.vendor_name,
    exp.description,
    exp.category?.name || 'Uncategorized',
    exp.amount.toString(),
    (exp.deductible_amount || 0).toString(),
    exp.is_tax_deductible ? 'Yes' : 'No',
    exp.payment_method || '',
    exp.confirmation_number || '',
    exp.tax_year.toString(),
    exp.quarter?.toString() || '',
    exp.has_receipt ? 'Yes' : 'No',
    exp.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

export function downloadExpenseCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
