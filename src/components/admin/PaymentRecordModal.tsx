import React, { useState } from 'react';
import { X, DollarSign, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { Invoice } from '../../lib/supabase';
import { recordPayment } from '../../services/invoiceService';

interface PaymentRecordModalProps {
  invoice: Invoice;
  onClose: () => void;
  onPaymentRecorded: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
];

export default function PaymentRecordModal({ invoice, onClose, onPaymentRecorded }: PaymentRecordModalProps) {
  const [paymentAmount, setPaymentAmount] = useState(invoice.amount_due);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const remainingAfterPayment = invoice.amount_due - paymentAmount;

  const handleQuickAmount = (percentage: number) => {
    setPaymentAmount(Math.round((invoice.amount_due * percentage) * 100) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentAmount <= 0) {
      setMessage({ type: 'error', text: 'Payment amount must be greater than zero' });
      return;
    }

    if (paymentAmount > invoice.amount_due) {
      setMessage({ type: 'error', text: 'Payment amount cannot exceed amount due' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await recordPayment({
        invoice_id: invoice.id,
        payment_date: paymentDate,
        payment_amount: paymentAmount,
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
        notes: notes || undefined,
      });

      setMessage({ type: 'success', text: 'Payment recorded successfully!' });
      setTimeout(() => {
        onPaymentRecorded();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setMessage({ type: 'error', text: 'Failed to record payment. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl max-w-2xl w-full flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Record Payment</h2>
            <p className="text-sm text-slate-600 mt-1">Invoice {invoice.invoice_number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
              {message.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Total Amount</p>
                <p className="text-lg font-bold text-slate-900">${invoice.total_amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-600">Amount Due</p>
                <p className="text-lg font-bold text-blue-600">${invoice.amount_due.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input name="paymentAmount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="0.00"
                min="0"
                max={invoice.amount_due}
                step="0.01"
                required
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount(1)}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                Full Amount
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(0.5)}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(0.25)}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                25%
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date</label>
            <input name="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
            <select name="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Reference
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <input name="paymentReference"
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Check number, transaction ID, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Additional notes about this payment..."
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Remaining Balance After Payment</p>
                <p className={`text-2xl font-bold ${remainingAfterPayment === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  ${remainingAfterPayment.toFixed(2)}
                </p>
              </div>
              {remainingAfterPayment === 0 && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">Paid in Full</span>
                </div>
              )}
            </div>
          </div>

          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Recording...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
