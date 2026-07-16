import React, { useEffect, useState } from 'react';
import { X, DollarSign, Calendar, Save, Repeat } from 'lucide-react';
import {
  BILLING_CYCLES,
  monthlyAmount,
  type BillingCycle,
  type Subscription,
} from '../../services/burnRateService';

interface SubscriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subscription: Partial<Subscription>) => Promise<void>;
  subscription?: Subscription | null;
  businessId: string;
}

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`;
};

export default function SubscriptionFormModal({
  isOpen,
  onClose,
  onSave,
  subscription,
  businessId,
}: SubscriptionFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextDueDate, setNextDueDate] = useState(todayISO());
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (subscription) {
      setName(subscription.name);
      setDescription(subscription.description || '');
      setAmount(subscription.amount.toString());
      setBillingCycle(subscription.billing_cycle);
      setNextDueDate(subscription.next_due_date || todayISO());
      setCategory(subscription.category || '');
    } else {
      resetForm();
    }
  }, [subscription, isOpen]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setAmount('');
    setBillingCycle('monthly');
    setNextDueDate(todayISO());
    setCategory('');
  };

  const parsedAmount = parseFloat(amount);
  const monthlyEquivalent =
    !isNaN(parsedAmount) && parsedAmount > 0
      ? monthlyAmount({ amount: parsedAmount, billing_cycle: billingCycle })
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: Partial<Subscription> = {
        business_id: businessId,
        name: name.trim(),
        description: description.trim() || null,
        amount: parseFloat(amount),
        billing_cycle: billingCycle,
        next_due_date: nextDueDate || null,
        category: category.trim() || null,
      };

      if (subscription) {
        payload.id = subscription.id;
      }

      await onSave(payload);
      setMessage({ type: 'success', text: 'Subscription saved successfully!' });
      setTimeout(() => {
        resetForm();
        onClose();
      }, 800);
    } catch (error) {
      console.error('Error saving subscription:', error);
      setMessage({ type: 'error', text: 'Failed to save subscription. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-2xl w-full max-h-dvh sm:max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {subscription ? 'Edit Subscription' : 'Add Subscription'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-4 p-4 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subscription Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Adobe Creative Cloud, QuickBooks, Insurance"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="amount"
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Billing Cycle <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Repeat className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <select
                    name="billingCycle"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {BILLING_CYCLES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Next Due Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    name="nextDueDate"
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <input
                  name="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Software, Insurance, Marketing"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Optional details about this subscription..."
                />
              </div>

              {monthlyEquivalent > 0 && (
                <div className="md:col-span-2 p-4 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-800">Normalized cost</span>
                  <span className="text-sm text-emerald-900">
                    <strong>
                      {monthlyEquivalent.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </strong>
                    /mo
                    <span className="text-emerald-700">
                      {' '}
                      ·{' '}
                      {(monthlyEquivalent * 12).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      })}
                      /yr
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div
            className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
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
                  {subscription ? 'Update' : 'Add Subscription'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
