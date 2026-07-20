import { useState, useEffect } from 'react';
import { X, Save, HardHat, Plus } from 'lucide-react';
import { supabase, Contractor, JobContractorWithContractor } from '../../lib/supabase';
import { formatCurrency } from '../../utils/jobCalculations';
import {
  getContractors,
  addJobContractor,
  updateJobContractor,
} from '../../services/contractorService';
import ContractorFormModal from './ContractorFormModal';

interface JobContractorModalProps {
  jobId: string;
  businessId: string;
  organizationId?: string | null;
  jobRevenue?: number | null;
  assignment: JobContractorWithContractor | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function JobContractorModal({
  jobId,
  businessId,
  organizationId,
  jobRevenue,
  assignment,
  onClose,
  onSaved,
}: JobContractorModalProps) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddContractor, setShowAddContractor] = useState(false);

  const [formData, setFormData] = useState({
    contractor_id: '',
    amount_paid: '',
    work_description: '',
    payment_date: '',
    payment_method: '',
    notes: '',
  });

  useEffect(() => {
    loadContractors();
    loadPaymentMethods();
  }, [businessId]);

  useEffect(() => {
    if (assignment) {
      setFormData({
        contractor_id: assignment.contractor_id || '',
        amount_paid: assignment.amount_paid != null ? String(assignment.amount_paid) : '',
        work_description: assignment.work_description || '',
        payment_date: assignment.payment_date || '',
        payment_method: assignment.payment_method || '',
        notes: assignment.notes || '',
      });
    }
  }, [assignment]);

  const loadContractors = async () => {
    const data = await getContractors(businessId);
    setContractors(data);
  };

  const loadPaymentMethods = async () => {
    const { data } = await supabase
      .from('payment_methods')
      .select('method_name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('display_order');
    if (data) setPaymentMethods(data.map((m) => m.method_name));
  };

  const handleSave = async () => {
    if (!formData.contractor_id) {
      setError('Please select a contractor');
      return;
    }

    const amount = parseFloat(formData.amount_paid);
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid amount paid');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        contractor_id: formData.contractor_id,
        amount_paid: amount,
        work_description: formData.work_description.trim() || null,
        payment_date: formData.payment_date || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes.trim() || null,
      };

      if (assignment) {
        await updateJobContractor(assignment.id, payload);
      } else {
        await addJobContractor({
          ...payload,
          job_id: jobId,
          business_id: businessId,
          ...(organizationId ? { organization_id: organizationId } : {}),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving job contractor:', err);
      setError(err instanceof Error ? err.message : 'Failed to save contractor payment');
    } finally {
      setSaving(false);
    }
  };

  const amountValue = parseFloat(formData.amount_paid);
  const showRevenueHint = typeof jobRevenue === 'number' && jobRevenue > 0 && !isNaN(amountValue) && amountValue > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-w-lg w-full max-h-dvh sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HardHat className="w-5 h-5 text-emerald-600" />
            {assignment ? 'Edit Contractor Payment' : 'Add Contractor to Job'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Contractor <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={formData.contractor_id}
                onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select a contractor</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddContractor(true)}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-1 text-sm whitespace-nowrap"
                title="Add a new contractor"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
            {contractors.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                No contractors yet — use "New" to add one.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Amount Paid <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount_paid}
              onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="0.00"
            />
            {showRevenueHint && (
              <p className="mt-1 text-xs text-slate-500">
                {formatCurrency(amountValue)} of this job's {formatCurrency(jobRevenue ?? 0)} revenue
                {' '}({((amountValue / (jobRevenue || 1)) * 100).toFixed(0)}%).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Work Done</label>
            <input
              type="text"
              value={formData.work_description}
              onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. Assembled 3 dressers"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select method</option>
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {showAddContractor && (
        <ContractorFormModal
          contractor={null}
          businessId={businessId}
          organizationId={organizationId}
          onClose={() => setShowAddContractor(false)}
          onSave={(saved) => {
            setContractors((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
            setFormData((prev) => ({ ...prev, contractor_id: saved.id }));
            setShowAddContractor(false);
          }}
        />
      )}
    </div>
  );
}
