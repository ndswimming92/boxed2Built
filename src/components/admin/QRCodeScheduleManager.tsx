import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Clock, ArrowRight } from 'lucide-react';
import { QRCodeWithSchedules, QRCodeSchedule } from '../../lib/supabase';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../../services/qrCodeService';

type Props = {
  qrCode: QRCodeWithSchedules;
  onUpdate: () => void;
};

export default function QRCodeScheduleManager({ qrCode, onUpdate }: Props) {
  const [schedules, setSchedules] = useState<QRCodeSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<QRCodeSchedule | null>(null);
  const [formData, setFormData] = useState({
    destination_url: '',
    start_datetime: '',
    end_datetime: '',
    priority: 0,
    is_active: true
  });

  useEffect(() => {
    setSchedules(qrCode.schedules || []);
  }, [qrCode]);

  const resetForm = () => {
    setFormData({
      destination_url: '',
      start_datetime: '',
      end_datetime: '',
      priority: 0,
      is_active: true
    });
    setEditingSchedule(null);
    setShowForm(false);
  };

  const handleEdit = (schedule: QRCodeSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      destination_url: schedule.destination_url,
      start_datetime: schedule.start_datetime.slice(0, 16),
      end_datetime: schedule.end_datetime.slice(0, 16),
      priority: schedule.priority,
      is_active: schedule.is_active
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(formData.end_datetime) <= new Date(formData.start_datetime)) {
      alert('End date/time must be after start date/time');
      return;
    }

    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, {
          destination_url: formData.destination_url,
          start_datetime: new Date(formData.start_datetime).toISOString(),
          end_datetime: new Date(formData.end_datetime).toISOString(),
          priority: formData.priority,
          is_active: formData.is_active
        });
      } else {
        await createSchedule({
          qr_code_id: qrCode.id,
          destination_url: formData.destination_url,
          start_datetime: new Date(formData.start_datetime).toISOString(),
          end_datetime: new Date(formData.end_datetime).toISOString(),
          priority: formData.priority,
          is_active: formData.is_active
        });
      }
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await deleteSchedule(id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isScheduleActive = (schedule: QRCodeSchedule) => {
    const now = new Date();
    const start = new Date(schedule.start_datetime);
    const end = new Date(schedule.end_datetime);
    return schedule.is_active && now >= start && now <= end;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Time-Based Redirects</h3>
          <p className="text-sm text-gray-600 mt-1">
            Set up different destinations based on date and time
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination URL *
            </label>
            <input name="destination_url"
              type="url"
              value={formData.destination_url}
              onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="https://example.com/special-offer"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input name="start_datetime"
                type="datetime-local"
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time *
              </label>
              <input name="end_datetime"
                type="datetime-local"
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <input name="priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              min="0"
            />
            <p className="text-sm text-gray-500 mt-1">
              Higher priority schedules take precedence when overlapping (0 = lowest)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input name="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
            </button>
          </div>
        </form>
      )}

      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No schedules configured yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Add your first schedule to enable time-based redirects
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules
            .sort((a, b) => b.priority - a.priority)
            .map((schedule) => (
              <div
                key={schedule.id}
                className={`border rounded-lg p-4 ${
                  isScheduleActive(schedule)
                    ? 'bg-green-50 border-green-200'
                    : schedule.is_active
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isScheduleActive(schedule) && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
                          ACTIVE NOW
                        </span>
                      )}
                      {!schedule.is_active && (
                        <span className="px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded">
                          DISABLED
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                        Priority: {schedule.priority}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 font-medium break-all mb-3">
                      {schedule.destination_url}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(schedule.start_datetime)}
                      </div>
                      <ArrowRight className="w-4 h-4" />
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDateTime(schedule.end_datetime)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
