import React, { useState, useEffect } from 'react';
import { X, AlertCircle, DollarSign } from 'lucide-react';
import Modal from '../Modal';
import Button from '../ui/Button';
import { Invoice } from '../../lib/supabase';
import { calculateLateFee, manuallyAdjustLateFee } from '../../services/invoiceService';

interface LateFeeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSuccess: () => void;
}

export default function LateFeeManagementModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: LateFeeManagementModalProps) {
  const [calculatedFee, setCalculatedFee] = useState<number>(0);
  const [manualFee, setManualFee] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      loadCalculatedFee();
      setManualFee(invoice.late_fee_charged.toString());
      setReason('');
    }
  }, [isOpen, invoice]);

  const loadCalculatedFee = async () => {
    setCalculating(true);
    try {
      const fee = await calculateLateFee(invoice.id);
      setCalculatedFee(fee);
    } catch (error) {
      console.error('Error calculating late fee:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleApplyCalculatedFee = async () => {
    if (!window.confirm(`Apply calculated late fee of $${calculatedFee.toFixed(2)}?`)) {
      return;
    }

    setLoading(true);
    try {
      await manuallyAdjustLateFee(invoice.id, calculatedFee, 'Applied calculated late fee');
      alert('Late fee applied successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error applying late fee:', error);
      alert('Failed to apply late fee. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualFee = async () => {
    const feeAmount = parseFloat(manualFee);

    if (isNaN(feeAmount) || feeAmount < 0) {
      alert('Please enter a valid late fee amount');
      return;
    }

    if (!reason.trim()) {
      alert('Please provide a reason for the manual adjustment');
      return;
    }

    if (!window.confirm(`Apply manual late fee of $${feeAmount.toFixed(2)}?`)) {
      return;
    }

    setLoading(true);
    try {
      await manuallyAdjustLateFee(invoice.id, feeAmount, reason);
      alert('Late fee applied successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error applying late fee:', error);
      alert('Failed to apply late fee. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWaiveFee = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for waiving the late fee');
      return;
    }

    if (!window.confirm('Waive the late fee for this invoice?')) {
      return;
    }

    setLoading(true);
    try {
      await manuallyAdjustLateFee(invoice.id, 0, `Waived: ${reason}`);
      alert('Late fee waived successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error waiving late fee:', error);
      alert('Failed to waive late fee. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = new Date(invoice.due_date) < new Date() &&
                    invoice.status !== 'paid' &&
                    invoice.status !== 'cancelled';

  const gracePeriodEnd = invoice.late_fee_grace_days
    ? new Date(new Date(invoice.due_date).getTime() + invoice.late_fee_grace_days * 24 * 60 * 60 * 1000)
    : new Date(invoice.due_date);

  const isInGracePeriod = new Date() <= gracePeriodEnd;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Manage Late Fee</h2>
            <p className="text-slate-600">Invoice {invoice.invoice_number}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Invoice Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Due Date</p>
              <p className="font-medium text-slate-900">
                {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Status</p>
              <p className="font-medium text-slate-900 capitalize">
                {invoice.status.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Current Late Fee</p>
              <p className="font-medium text-slate-900">
                ${invoice.late_fee_charged.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Grace Period</p>
              <p className="font-medium text-slate-900">
                {invoice.late_fee_grace_days || 0} days
              </p>
            </div>
          </div>

          {!invoice.late_fee_enabled && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Late fees are not enabled for this invoice
              </p>
            </div>
          )}

          {isInGracePeriod && isOverdue && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Invoice is in grace period until {gracePeriodEnd.toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {invoice.late_fee_enabled && (
          <>
            <div className="bg-emerald-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Calculated Late Fee</h3>
              {calculating ? (
                <p className="text-slate-600">Calculating...</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold text-emerald-600">
                      ${calculatedFee.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-600">
                      ({invoice.late_fee_type === 'fixed' ? 'Fixed' : `${invoice.late_fee_amount}%`})
                    </span>
                  </div>
                  {calculatedFee > 0 && (
                    <Button
                      onClick={handleApplyCalculatedFee}
                      disabled={loading}
                      className="w-full"
                    >
                      Apply Calculated Fee
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Manual Adjustment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Late Fee Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      value={manualFee}
                      onChange={(e) => setManualFee(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reason for Adjustment
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Explain why you're adjusting or waiving the late fee..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleApplyManualFee}
                    disabled={loading}
                    className="flex-1"
                  >
                    Apply Manual Fee
                  </Button>
                  <Button
                    onClick={handleWaiveFee}
                    disabled={loading}
                    variant="outline"
                    className="flex-1"
                  >
                    Waive Fee
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
