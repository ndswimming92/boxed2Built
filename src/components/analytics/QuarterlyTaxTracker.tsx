import { useState } from 'react';
import { QuarterlyTaxPayment } from '../../services/taxService';
import { Calendar, CheckCircle, AlertCircle, Plus, DollarSign, X } from 'lucide-react';
import { addQuarterlyPayment } from '../../services/taxService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface QuarterlyTaxTrackerProps {
  businessId: string;
  taxYear: number;
  quarterlyEstimate: number;
  payments: QuarterlyTaxPayment[];
  onPaymentAdded: () => void;
}

interface QuarterInfo {
  quarter: number;
  label: string;
  dueDate: Date;
  months: string;
}

const QUARTERS: QuarterInfo[] = [
  { quarter: 1, label: 'Q1', dueDate: new Date(2024, 3, 15), months: 'Jan - Mar' },
  { quarter: 2, label: 'Q2', dueDate: new Date(2024, 5, 15), months: 'Apr - May' },
  { quarter: 3, label: 'Q3', dueDate: new Date(2024, 8, 15), months: 'Jun - Aug' },
  { quarter: 4, label: 'Q4', dueDate: new Date(2025, 0, 15), months: 'Sep - Dec' },
];

export default function QuarterlyTaxTracker({
  businessId,
  taxYear,
  quarterlyEstimate,
  payments,
  onPaymentAdded,
}: QuarterlyTaxTrackerProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('eftps');
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    return maskFinancialValue(formatted);
  };

  const getQuarterPayments = (quarter: number): QuarterlyTaxPayment[] => {
    return payments.filter((p) => p.quarter === quarter);
  };

  const getQuarterTotal = (quarter: number): number => {
    return getQuarterPayments(quarter).reduce((sum, p) => sum + p.payment_amount, 0);
  };

  const isQuarterPaid = (quarter: number): boolean => {
    return getQuarterTotal(quarter) >= quarterlyEstimate;
  };

  const handleAddPayment = async () => {
    if (!selectedQuarter || !paymentAmount || !businessId) return;

    setSaving(true);

    const payment = {
      business_id: businessId,
      tax_year: taxYear,
      quarter: selectedQuarter,
      payment_amount: parseFloat(paymentAmount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      confirmation_number: confirmationNumber || null,
      federal_income_tax_amount: 0,
      self_employment_tax_amount: 0,
      notes: null,
    };

    const result = await addQuarterlyPayment(payment);

    if (result) {
      setShowAddModal(false);
      setSelectedQuarter(null);
      setPaymentAmount('');
      setConfirmationNumber('');
      onPaymentAdded();
    }

    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Quarterly Tax Tracker</h3>
          <p className="text-sm text-slate-600 mt-1">Track your estimated tax payments for {taxYear}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Payment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUARTERS.map((quarter) => {
          const quarterPayments = getQuarterPayments(quarter.quarter);
          const totalPaid = getQuarterTotal(quarter.quarter);
          const isPaid = isQuarterPaid(quarter.quarter);
          const isOverdue = new Date() > quarter.dueDate && !isPaid;

          return (
            <div
              key={quarter.quarter}
              className={`p-4 rounded-lg border-2 ${
                isPaid
                  ? 'bg-emerald-50 border-emerald-200'
                  : isOverdue
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">{quarter.label}</span>
                  {isPaid ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : isOverdue ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    setSelectedQuarter(quarter.quarter);
                    setShowAddModal(true);
                  }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  + Add
                </button>
              </div>

              <p className="text-sm text-slate-600 mb-2">{quarter.months}</p>

              <div className="mb-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  <Calendar className="w-3 h-3" />
                  <span>Due: {quarter.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Estimated:</span>
                  <span className="font-medium text-slate-900">{formatCurrency(quarterlyEstimate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Paid:</span>
                  <span className={`font-bold ${isPaid ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {formatCurrency(totalPaid)}
                  </span>
                </div>

                {quarterPayments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-2">{quarterPayments.length} payment(s)</p>
                    <div className="space-y-1">
                      {quarterPayments.map((payment) => (
                        <div key={payment.id} className="text-xs text-slate-600">
                          {new Date(payment.payment_date).toLocaleDateString()}: {formatCurrency(payment.payment_amount)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isPaid && totalPaid > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-amber-700 font-medium">
                    Remaining: {formatCurrency(quarterlyEstimate - totalPaid)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Add Tax Payment</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quarter</label>
                <select name="selectedQuarter"
                  value={selectedQuarter || ''}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select Quarter</option>
                  {QUARTERS.map((q) => (
                    <option key={q.quarter} value={q.quarter}>
                      {q.label} ({q.months})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input name="paymentAmount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date</label>
                <input name="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select name="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="eftps">EFTPS (Electronic Federal Tax Payment System)</option>
                  <option value="irs_direct_pay">IRS Direct Pay</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirmation Number (Optional)
                </label>
                <input name="confirmationNumber"
                  type="text"
                  value={confirmationNumber}
                  onChange={(e) => setConfirmationNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="EFT123456789"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                disabled={saving || !selectedQuarter || !paymentAmount}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Add Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
