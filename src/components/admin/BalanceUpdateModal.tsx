import React, { useEffect, useState } from 'react';
import { X, DollarSign, Calendar, Save, Wallet } from 'lucide-react';
import type { BalanceSnapshot } from '../../services/burnRateService';

interface BalanceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snapshot: Partial<BalanceSnapshot>) => Promise<void>;
  businessId: string;
  currentBalance: number | null;
}

const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`;
};

export default function BalanceUpdateModal({
  isOpen,
  onClose,
  onSave,
  businessId,
  currentBalance,
}: BalanceUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [balance, setBalance] = useState('');
  const [recordedAt, setRecordedAt] = useState(todayISO());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBalance(currentBalance != null ? String(currentBalance) : '');
      setRecordedAt(todayISO());
      setNote('');
      setMessage(null);
    }
  }, [isOpen, currentBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await onSave({
        business_id: businessId,
        balance: parseFloat(balance),
        recorded_at: recordedAt,
        note: note.trim() || null,
      });
      setMessage({ type: 'success', text: 'Balance updated successfully!' });
      setTimeout(() => onClose(), 800);
    } catch (error) {
      console.error('Error updating balance:', error);
      setMessage({ type: 'error', text: 'Failed to update balance. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-lg w-full max-h-dvh sm:max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Update Balance</h2>
          </div>
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <p className="text-sm text-slate-600">
              Record your total cash on hand. Each update is saved as a snapshot so you can track
              your balance over time and drive the runway projection.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Total Balance <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="balance"
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">As of Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="recordedAt"
                  type="date"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Note</label>
              <input
                name="note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., After client payment, End of month reconcile"
              />
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
                  Save Balance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
