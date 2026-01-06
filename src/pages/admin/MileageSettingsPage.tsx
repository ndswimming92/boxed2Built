import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { MileageSettings } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, DollarSign, Calendar, Info } from 'lucide-react';

export default function MileageSettingsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MileageSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<MileageSettings | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    effective_date: new Date().toISOString().split('T')[0],
    rate_per_mile: 0.67,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: bizData } = await supabase
      .from('business_info')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (bizData) {
      setBusinessId(bizData.id);

      const { data: settingsData } = await supabase
        .from('mileage_settings')
        .select('*')
        .eq('business_id', bizData.id)
        .eq('is_active', true)
        .order('effective_date', { ascending: false });

      if (settingsData) {
        setSettings(settingsData);
      }
    }

    setLoading(false);
  };

  const handleOpenModal = (setting?: MileageSettings) => {
    if (setting) {
      setEditingSetting(setting);
      setFormData({
        effective_date: setting.effective_date,
        rate_per_mile: setting.rate_per_mile,
        notes: setting.notes || '',
      });
    } else {
      setEditingSetting(null);
      setFormData({
        effective_date: new Date().toISOString().split('T')[0],
        rate_per_mile: 0.67,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!businessId) return;

    if (!formData.effective_date || formData.rate_per_mile <= 0) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      if (editingSetting) {
        const { error } = await supabase
          .from('mileage_settings')
          .update({
            effective_date: formData.effective_date,
            rate_per_mile: formData.rate_per_mile,
            notes: formData.notes || null,
          })
          .eq('id', editingSetting.id);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Mileage rate updated successfully!' });
      } else {
        const { error } = await supabase.from('mileage_settings').insert({
          business_id: businessId,
          effective_date: formData.effective_date,
          rate_per_mile: formData.rate_per_mile,
          notes: formData.notes || null,
          is_active: true,
        });

        if (error) throw error;

        setMessage({ type: 'success', text: 'Mileage rate added successfully!' });
      }

      setShowModal(false);
      setEditingSetting(null);
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving mileage setting:', error);
      setMessage({ type: 'error', text: 'Failed to save mileage rate' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mileage rate?')) return;

    try {
      const { error } = await supabase
        .from('mileage_settings')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Mileage rate deleted successfully!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting mileage setting:', error);
      setMessage({ type: 'error', text: 'Failed to delete mileage rate' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCurrentRate = (): MileageSettings | null => {
    const today = new Date().toISOString().split('T')[0];
    const currentSettings = settings.filter((s) => s.effective_date <= today);
    return currentSettings.length > 0 ? currentSettings[0] : null;
  };

  const currentRate = getCurrentRate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mileage Settings</h1>
          <p className="text-gray-600 mt-1">Configure IRS mileage rates for tax deductions</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Mileage Rate</span>
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {currentRate && (
        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Current IRS Mileage Rate</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-blue-900">${currentRate.rate_per_mile.toFixed(3)}</span>
                <span className="text-gray-600">per mile</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Effective from {formatDate(currentRate.effective_date)}
              </p>
              {currentRate.notes && (
                <p className="text-sm text-gray-700 mt-2 italic">{currentRate.notes}</p>
              )}
            </div>
            <DollarSign className="w-12 h-12 text-blue-600" />
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">About Mileage Rates</p>
            <p>
              The IRS standard mileage rate is used to calculate the tax-deductible cost of operating a vehicle for
              business purposes. This rate typically changes annually. You can add historical rates to ensure accurate
              calculations for past trips.
            </p>
            <p className="mt-2">
              When tracking mileage, the system will automatically use the rate that was in effect on the date of
              travel.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Rate History</h2>
          <p className="text-sm text-gray-600 mt-1">{settings.length} rate(s) configured</p>
        </div>

        {settings.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">No mileage rates configured</p>
            <p className="text-sm text-gray-400">Add your first mileage rate to start tracking deductions</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {settings.map((setting) => {
              const isCurrent = currentRate?.id === setting.id;

              return (
                <div
                  key={setting.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    isCurrent ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="text-2xl font-bold text-gray-900">
                          ${setting.rate_per_mile.toFixed(3)}/mi
                        </div>
                        {isCurrent && (
                          <span className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>Effective from {formatDate(setting.effective_date)}</span>
                      </div>

                      {setting.notes && (
                        <p className="text-sm text-gray-600 italic">{setting.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleOpenModal(setting)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(setting.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingSetting ? 'Edit Mileage Rate' : 'Add Mileage Rate'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Effective Date *
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rate per Mile ($) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.rate_per_mile}
                  onChange={(e) =>
                    setFormData({ ...formData, rate_per_mile: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.670"
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
                  placeholder="e.g., 2024 IRS Standard Rate"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
