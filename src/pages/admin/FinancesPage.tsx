import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Plus,
  Filter,
  Search,
  Receipt,
  Edit,
  Trash2,
  ChevronDown,
  PieChart as PieChartIcon,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpensesByCategory,
  getMonthlyExpenses,
  exportExpensesToCSV,
  downloadExpenseCSV,
  uploadReceiptToStorage,
  type BusinessExpense,
  type ExpenseWithCategory,
  type ExpenseStats,
  type ExpenseByCategoryStats,
} from '../../services/expenseService';
import ExpenseFormModal from '../../components/admin/ExpenseFormModal';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function FinancesPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<ExpenseWithCategory[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<ExpenseByCategoryStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; amount: number; deductible: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDeductible, setFilterDeductible] = useState<'all' | 'deductible' | 'non-deductible'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, selectedYear]);

  useEffect(() => {
    applyFilters();
  }, [expenses, searchTerm, filterCategory, filterDeductible]);

  const fetchBusinessId = async () => {
    const { data } = await supabase
      .from('business_info')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setBusinessId(data.id);
    }
  };

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [expensesData, statsData, categoryData, monthlyExpenseData] = await Promise.all([
        getExpenses(businessId, { taxYear: selectedYear }),
        getExpenseStats(businessId, selectedYear),
        getExpensesByCategory(businessId, selectedYear),
        getMonthlyExpenses(businessId, selectedYear),
      ]);

      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
      setStats(statsData);
      setCategoryStats(categoryData);
      setMonthlyData(monthlyExpenseData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load expense data' });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...expenses];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.vendor_name.toLowerCase().includes(term) ||
          exp.description.toLowerCase().includes(term)
      );
    }

    if (filterCategory) {
      filtered = filtered.filter((exp) => exp.category_id === filterCategory);
    }

    if (filterDeductible === 'deductible') {
      filtered = filtered.filter((exp) => exp.is_tax_deductible);
    } else if (filterDeductible === 'non-deductible') {
      filtered = filtered.filter((exp) => !exp.is_tax_deductible);
    }

    setFilteredExpenses(filtered);
  };

  const handleSaveExpense = async (expenseData: Partial<BusinessExpense>, receiptFile?: File) => {
    if (!businessId) return;

    try {
      let expense: BusinessExpense | null = null;

      if (editingExpense) {
        expense = await updateExpense(editingExpense.id, expenseData);
      } else {
        expense = await createExpense(expenseData);
      }

      if (expense && receiptFile) {
        const receiptUrl = await uploadReceiptToStorage(businessId, expense.id, receiptFile);
        if (receiptUrl) {
          await updateExpense(expense.id, {
            receipt_url: receiptUrl,
            has_receipt: true,
          });
        }
      }

      setMessage({
        type: 'success',
        text: editingExpense ? 'Expense updated successfully!' : 'Expense added successfully!',
      });

      setTimeout(() => setMessage(null), 3000);

      setShowExpenseModal(false);
      setEditingExpense(null);
      fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      setMessage({ type: 'error', text: 'Failed to save expense' });
    }
  };

  const handleEditExpense = (expense: ExpenseWithCategory) => {
    setEditingExpense(expense as BusinessExpense);
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    const success = await deleteExpense(id);
    if (success) {
      setMessage({ type: 'success', text: 'Expense deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
      fetchData();
    } else {
      setMessage({ type: 'error', text: 'Failed to delete expense' });
    }
  };

  const handleExport = () => {
    const csv = exportExpensesToCSV(filteredExpenses);
    const filename = `expenses_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadExpenseCSV(csv, filename);
    setMessage({ type: 'success', text: 'Expenses exported successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const taxSavings = useMemo(() => {
    if (!stats) return 0;
    return stats.deductibleExpenses * 0.30;
  }, [stats]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    expenses.forEach((exp) => {
      if (exp.category) {
        categories.add(exp.category.id);
      }
    });
    return Array.from(categories);
  }, [expenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Business Finances</h1>
          <p className="text-slate-600">Track expenses and monitor tax impact</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => {
              setEditingExpense(null);
              setShowExpenseModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Expense</span>
          </button>
        </div>
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

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingDown className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">{stats.expenseCount} expenses</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-6 h-6 text-emerald-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm text-slate-600 mb-1">Tax Deductible</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.deductibleExpenses)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {((stats.deductibleExpenses / stats.totalExpenses) * 100).toFixed(0)}% of total
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Avg per Expense</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.avgExpenseAmount)}</p>
            <p className="text-xs text-slate-500 mt-1">Year {selectedYear}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl border border-emerald-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-emerald-800 mb-1 font-medium">Est. Tax Savings</p>
            <p className="text-2xl font-bold text-emerald-900">{formatCurrency(taxSavings)}</p>
            <p className="text-xs text-emerald-700 mt-1">~30% of deductible expenses</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Expenses by Category</h2>
            <PieChartIcon className="w-5 h-5 text-slate-400" />
          </div>
          {categoryStats.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    dataKey="total_amount"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ category_name, percentage_of_total }) =>
                      `${category_name}: ${percentage_of_total.toFixed(0)}%`
                    }
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <p>No expense data available</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Monthly Expenses</h2>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          {monthlyData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="Total Expenses"
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="deductible"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Deductible"
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <p>No monthly data available</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">All Expenses</h2>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Categories</option>
                {categoryStats.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tax Deductible</label>
              <select
                value={filterDeductible}
                onChange={(e) => setFilterDeductible(e.target.value as any)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Expenses</option>
                <option value="deductible">Deductible Only</option>
                <option value="non-deductible">Non-Deductible Only</option>
              </select>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Deductible
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                      {new Date(expense.expense_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{expense.vendor_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{expense.description}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                        {expense.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expense.is_tax_deductible ? (
                        <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expense.has_receipt ? (
                        <Receipt className="w-5 h-5 text-emerald-600 mx-auto" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No expenses found. Click "Add Expense" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExpenseModal && businessId && (
        <ExpenseFormModal
          isOpen={showExpenseModal}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          onSave={handleSaveExpense}
          expense={editingExpense}
          businessId={businessId}
        />
      )}
    </div>
  );
}
