import React, { useEffect, useState } from 'react';
import { supabase, Service } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, Briefcase } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const emptyService: Partial<Service> = {
    name: '',
    description: '',
    category: '',
    base_price: 0,
    min_price: null,
    max_price: null,
    price_range_description: '',
    price_currency: 'USD',
    duration_minutes: null,
    is_featured: false,
    display_order: 0,
    is_active: true,
  };

  const [formData, setFormData] = useState<Partial<Service>>(emptyService);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (businessInfo) {
        setBusinessId(businessInfo.id);
        const { data } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('display_order', { ascending: true });

        if (data) {
          setServices(data);
        }
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ ...emptyService, display_order: services.length });
  };

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setIsAdding(false);
    setFormData(service);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyService);
  };

  const handleSave = async () => {
    if (!businessId) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('services')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Service updated successfully!' });
      } else {
        const { error } = await supabase
          .from('services')
          .insert([{ ...formData, business_id: businessId }]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Service added successfully!' });
      }

      handleCancel();
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving service:', error);
      setMessage({ type: 'error', text: 'Failed to save service' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Service deleted successfully!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting service:', error);
      setMessage({ type: 'error', text: 'Failed to delete service' });
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !service.is_active })
        .eq('id', service.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Services</h1>
          <p className="text-slate-600">Manage your service offerings</p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {(isAdding || editingId) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              {editingId ? 'Edit Service' : 'Add New Service'}
            </h2>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Typical Price Range</h3>
              <p className="text-xs text-slate-600 mb-4">
                Specify the typical price range for this service to help customers understand potential cost variations based on complexity, materials, or other factors.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Minimum Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_price || ''}
                    onChange={(e) => setFormData({ ...formData, min_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., 50.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Maximum Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_price || ''}
                    onChange={(e) => setFormData({ ...formData, max_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., 200.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Price Range Notes
                </label>
                <textarea
                  value={formData.price_range_description || ''}
                  onChange={(e) => setFormData({ ...formData, price_range_description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Explain factors that affect pricing (e.g., 'Price varies based on furniture size and complexity')"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.base_price || ''}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes || ''}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order || ''}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_featured || false}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700">Featured Service</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active !== false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {services.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No services yet</p>
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Service
            </button>
          </div>
        ) : (
          services.map((service) => (
            <div
              key={service.id}
              className={`bg-white rounded-xl border border-slate-200 p-6 ${
                !service.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                    {service.is_featured && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                        Featured
                      </span>
                    )}
                    {!service.is_active && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mb-3">{service.description}</p>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-4 text-slate-500">
                      <span className="font-semibold text-emerald-600">
                        Base: ${service.base_price.toFixed(2)}
                      </span>
                      {service.category && <span>Category: {service.category}</span>}
                      {service.duration_minutes && <span>{service.duration_minutes} min</span>}
                    </div>
                    {(service.min_price !== null || service.max_price !== null) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="font-medium">Typical Range:</span>
                        {service.min_price !== null && service.max_price !== null ? (
                          <span>${service.min_price.toFixed(2)} - ${service.max_price.toFixed(2)}</span>
                        ) : service.min_price !== null ? (
                          <span>From ${service.min_price.toFixed(2)}</span>
                        ) : (
                          <span>Up to ${service.max_price!.toFixed(2)}</span>
                        )}
                      </div>
                    )}
                    {service.price_range_description && (
                      <div className="text-xs text-slate-500 italic">
                        {service.price_range_description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(service)}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      service.is_active
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {service.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
