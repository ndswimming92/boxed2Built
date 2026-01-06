import React, { useState, useEffect } from 'react';
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

export default function MileageRecordModal({
  record,
  jobId,
  businessId,
  onClose,
  onSave,
}: MileageRecordModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [irsRate, setIrsRate] = useState(0.67);

  const [formData, setFormData] = useState({
    distance_miles: 0,
    trip_date: new Date().toISOString().split('T')[0],
    purpose: '',
    notes: '',
  });

  useEffect(() => {
    fetchIrsRate();

    if (record) {
      setFormData({
        distance_miles: record.distance_miles,
        trip_date: record.trip_date,
        purpose: record.purpose || '',
        notes: record.notes || '',
      });
      setIrsRate(record.irs_rate_per_mile);
    }
  }, [record]);

  const fetchIrsRate = async () => {
    const rate = await mileageTracker.getCurrentMileageRate(businessId);
    setIrsRate(rate);
  };

  const handleSave = async () => {
    if (formData.distance_miles <= 0) {
      setError('Distance must be greater than 0');
      return;
    }

    if (!formData.trip_date) {
      setError('Trip date is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (record) {
        const result = await mileageTracker.updateMileageRecord(record.id, {
          distance_miles: formData.distance_miles,
          trip_date: formData.trip_date,
          purpose: formData.purpose || null,
          notes: formData.notes || null,
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
          formData.distance_miles,
          formData.trip_date,
          irsRate,
          formData.purpose || undefined,
          formData.notes || undefined
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

  const calculatedDeduction = formData.distance_miles * irsRate;

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
              type="number"
              step="0.01"
              min="0"
              value={formData.distance_miles}
              onChange={(e) => setFormData({ ...formData, distance_miles: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Trip Date *
            </label>
            <input
              type="date"
              value={formData.trip_date}
              onChange={(e) => setFormData({ ...formData, trip_date: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional details..."
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">IRS Rate:</span>
              <span className="font-semibold text-gray-900">${irsRate.toFixed(3)}/mile</span>
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
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
