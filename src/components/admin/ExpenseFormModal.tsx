import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Receipt, Upload, Save } from 'lucide-react';
import type { BusinessExpense, ExpenseCategory } from '../../services/expenseService';
import { getExpenseCategories } from '../../services/expenseService';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<BusinessExpense>, receiptFile?: File) => Promise<void>;
  expense?: BusinessExpense | null;
  businessId: string;
}

export default function ExpenseFormModal({ isOpen, onClose, onSave, expense, businessId }: ExpenseFormModalProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [deductibleAmount, setDeductibleAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState('monthly');

  useEffect(() => {
    if (isOpen && businessId) {
      fetchCategories();
    }
  }, [isOpen, businessId]);

  useEffect(() => {
    if (expense) {
      setExpenseDate(expense.expense_date);
      setVendorName(expense.vendor_name);
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategoryId(expense.category_id || '');
      setPaymentMethod(expense.payment_method || '');
      setConfirmationNumber(expense.confirmation_number || '');
      setIsTaxDeductible(expense.is_tax_deductible);
      setDeductibleAmount(expense.deductible_amount?.toString() || '');
      setNotes(expense.notes || '');
      setIsRecurring(expense.is_recurring);
      setRecurrencePattern(expense.recurrence_pattern || 'monthly');
    } else {
      resetForm();
    }
  }, [expense]);

  useEffect(() => {
    if (isTaxDeductible && amount) {
      setDeductibleAmount(amount);
    } else if (!isTaxDeductible) {
      setDeductibleAmount('0');
    }
  }, [isTaxDeductible, amount]);

  const fetchCategories = async () => {
    const cats = await getExpenseCategories(businessId);
    setCategories(cats);
  };

  const resetForm = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setExpenseDate(`${year}-${month}-${day}`);
    setVendorName('');
    setDescription('');
    setAmount('');
    setCategoryId('');
    setPaymentMethod('');
    setConfirmationNumber('');
    setIsTaxDeductible(true);
    setDeductibleAmount('');
    setNotes('');
    setReceiptFile(null);
    setIsRecurring(false);
    setRecurrencePattern('monthly');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const expenseData: Partial<BusinessExpense> = {
        business_id: businessId,
        expense_date: expenseDate,
        vendor_name: vendorName,
        description,
        amount: parseFloat(amount),
        category_id: categoryId || null,
        payment_method: paymentMethod || null,
        confirmation_number: confirmationNumber || null,
        is_tax_deductible: isTaxDeductible,
        deductible_amount: deductibleAmount ? parseFloat(deductibleAmount) : null,
        notes: notes || null,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        has_receipt: !!receiptFile || (expense?.has_receipt || false),
      };

      if (expense) {
        expenseData.id = expense.id;
      }

      await onSave(expenseData, receiptFile || undefined);
      setMessage({ type: 'success', text: 'Expense saved successfully!' });
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving expense:', error);
      setMessage({ type: 'error', text: 'Failed to save expense. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-3xl w-full max-h-dvh sm:max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {expense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-4 p-4 rounded-lg flex items-start gap-3 ${
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vendor / Merchant Name <span className="text-red-500">*</span>
              </label>
              <input name="vendorName"
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., Amazon, Home Depot, Verizon"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <input name="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., Office supplies, Website hosting, Business insurance"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <select name="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
              <select name="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select payment method...</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Venmo">Venmo</option>
                <option value="Zelle">Zelle</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirmation / Transaction Number
              </label>
              <input name="confirmationNumber"
                type="text"
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Receipt or transaction number"
              />
            </div>

            <div className="md:col-span-2 flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="isTaxDeductible"
                checked={isTaxDeductible}
                onChange={(e) => setIsTaxDeductible(e.target.checked)}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="isTaxDeductible" className="font-medium text-slate-700 cursor-pointer">
                  Tax Deductible Business Expense
                </label>
                <p className="text-sm text-slate-600 mt-1">
                  Check this if the expense is deductible for tax purposes
                </p>
              </div>
            </div>

            {isTaxDeductible && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Deductible Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input name="deductibleAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={deductibleAmount}
                    onChange={(e) => setDeductibleAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Auto-filled from amount"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Usually same as amount. Adjust for partially deductible expenses (e.g., 50% of meals).
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Receipt / Documentation</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {receiptFile ? receiptFile.name : 'Upload Receipt (JPG, PNG, PDF)'}
                  </span>
                  <input name="file"
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                </label>
                {expense?.has_receipt && !receiptFile && (
                  <Receipt className="w-6 h-6 text-emerald-600" />
                )}
              </div>
            </div>

            <div className="md:col-span-2 flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="isRecurring" className="font-medium text-slate-700 cursor-pointer">
                  Recurring Expense
                </label>
                <p className="text-sm text-slate-600 mt-1">
                  This is a subscription or recurring payment
                </p>
                {isRecurring && (
                  <select name="recurrencePattern"
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value)}
                    className="mt-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Additional notes about this expense..."
              />
            </div>
          </div>

          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {expense ? 'Update Expense' : 'Add Expense'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
