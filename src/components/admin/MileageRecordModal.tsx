import React, { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import { mileageTracker } from '../../services/mileageTrackingService';
import type { MileageRecord } from '../../lib/supabase';

interface MileageRecordModalProps {
  record: MileageRecord | null;
  jobId: string;
  businessId: string;
  onClose: () => void;
  onSave: () => void;
}

type FormState = {
  distance_miles: string; // keep as string for smooth typing UX
  trip_date: string;
  purpose: string;
  notes: string;
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function MileageRecordModal({
  record,
  jobId,
  businessId,
  onClose,
  onSave,
}: MileageRecordModalProps) {
  const [saving, setSaving] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default is a fallback only; for new records we fetch the current rate.
  const [irsRate, setIrsRate] = useState(0.67);

  const [formData, setFormData] = useState<FormState>({
    distance_miles: '',
    trip_date: todayISO(),
    purpose: '',
    notes: '',
  });

  // Parse miles safely (string -> number)
  const miles = useMemo(() => {
    const n = Number.parseFloat(formData.distance_miles);
    return Number.isFinite(n) ? n : NaN;
  }, [formData.distance_miles]);

  const milesValid = Number.isFinite(miles) && miles > 0;
  const dateValid = Boolean(formData.trip_date);
  const canSave = milesValid && dateValid && !saving && !loadingRate;

  const calculatedDeduction = useMemo(() => {
    if (!Number.isFinite(miles) || miles <= 0) return 0;
    return miles * irsRate;
  }, [miles, irsRate]);

  // Initialize form + rate
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setError(null);

      if (record) {
        // Editing: preserve the record's historical rate (do NOT overwrite with "current")
        setFormData({
          distance_miles: String(record.distance_miles ?? ''),
          trip_date: record.trip_date ?? todayISO(),
          purpose: record.purpose ?? '',
          notes: record.notes ?? '',
        });
        setIrsRate(record.irs_rate_per_mile ?? 0.67);
        return;
      }

      // New record: set defaults + fetch current rate
      setFormData((prev) => ({
        ...prev,
        trip_date: prev.trip_date || todayISO(),
      }));

      setLoadingRate(true);
      try {
        const rate = await mileageTracker.getCurrentMileageRate(businessId);
        if (isMounted && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
          setIrsRate(rate);
        }
      } catch (e) {
        // Non-fatal: keep default rate, but don't block the user
        console.error('Error fetching IRS mileage rate:', e);
      } finally {
        if (isMounted) setLoadingRate(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [record, businessId]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setError(null); // clear error on user edits
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (!milesValid) {
      setError('Distance must be greater than 0');
      return;
    }

    if (!dateValid) {
      setError('Trip date is required');
      return;
    }

    setSaving(true);
    setError(null);

    // Normalize strings
    const purpose = formData.purpose.trim();
    const notes = formData.notes.trim();

    try {
      if (record) {
        const result = await mileageTracker.updateMileageRecord(record.id, {
          distance_miles: miles,
          trip_date: formData.trip_date,
          purpose: purpose ? purpose : null,
          notes: notes ? notes : null,
          irs_rate_per_mile: irsRate,
        });

        if (result.success) {
          onSave();
        } else {
          setError(result.error || 'Failed to update mileage record');
        }
      } else {
        const result = await mileageTracker.saveManualMileageRecord(
          businessId,
          jobId,
          miles,
          formData.trip_date,
          irsRate,
          purpose ? purpose : undefined,
          notes ? notes : undefined
        );

        if (result.success) {
          onSave();
        } else {
          setError(result.error || 'Failed to save mileage record');
        }
      }
    } catch (err) {
      console.error('Error saving mileage record:', err);
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {record ? 'Edit Mileage Record' : 'Add Manual Mileage Entry'}
          </h2>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Distance (miles) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.distance_miles}
              onChange={(e) => updateField('distance_miles', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              aria-invalid={!milesValid && formData.distance_miles.length > 0}
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: You can enter decimals (e.g., 12.5).
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Trip Date *
            </label>
            <input
              type="date"
              value={formData.trip_date}
              onChange={(e) => updateField('trip_date', e.target.value)}
              max={todayISO()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Purpose
            </label>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) => updateField('purpose', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Travel to job site"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional details..."
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">IRS Rate:</span>
              <span className="font-semibold text-gray-900">
                {loadingRate && !record ? 'Loading…' : '$' + irsRate.toFixed(3) + '/mile'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Tax Deduction:</span>
              <span className="text-lg font-bold text-green-700">
                ${calculatedDeduction.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
