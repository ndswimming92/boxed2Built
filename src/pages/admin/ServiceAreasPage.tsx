import React, { useEffect, useState } from 'react';
import { supabase, ServiceArea } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, MapPin } from 'lucide-react';

export default function ServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const emptyArea: Partial<ServiceArea> = {
    city_name: '',
    region: 'TN',
    country: 'US',
    postal_codes: null,
    latitude: null,
    longitude: null,
    radius_miles: 15,
    priority: 0,
    is_active: true,
  };

  const [formData, setFormData] = useState<Partial<ServiceArea>>(emptyArea);

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
          .from('service_areas')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('priority', { ascending: true });

        if (data) {
          setAreas(data);
        }
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('service_areas')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Service area updated!' });
      } else {
        const { error } = await supabase
          .from('service_areas')
          .insert([{ ...formData, business_id: businessId }]);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Service area added!' });
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData(emptyArea);
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save service area' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service area?')) return;

    try {
      const { error } = await supabase.from('service_areas').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Service area deleted!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete service area' });
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Service Areas</h1>
          <p className="text-slate-600">Manage locations where you provide services</p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => { setIsAdding(true); setFormData({ ...emptyArea, priority: areas.length }); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Area
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {(isAdding || editingId) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              {editingId ? 'Edit Service Area' : 'Add Service Area'}
            </h2>
            <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyArea); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">City Name *</label>
                <input name="city_name" type="text" value={formData.city_name || ''} onChange={(e) => setFormData({ ...formData, city_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Region *</label>
                <input name="region" type="text" value={formData.region || ''} onChange={(e) => setFormData({ ...formData, region: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="TN" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Country *</label>
                <input name="country" type="text" value={formData.country || ''} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="US" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Radius (miles)</label>
                <input name="radius_miles" type="number" value={formData.radius_miles || ''} onChange={(e) => setFormData({ ...formData, radius_miles: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                <input name="priority" type="number" value={formData.priority || ''} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input name="is_active" type="checkbox" checked={formData.is_active !== false} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                <Save className="w-5 h-5" /> Save
              </button>
              <button onClick={() => { setIsAdding(false); setEditingId(null); setFormData(emptyArea); }} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {areas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No service areas yet</p>
          </div>
        ) : (
          areas.map((area) => (
            <div key={area.id} className={`bg-white rounded-xl border border-slate-200 p-6 ${!area.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{area.city_name}, {area.region}</h3>
                    {!area.is_active && <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>Radius: {area.radius_miles} miles</span>
                    <span>Priority: {area.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingId(area.id); setFormData(area); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(area.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
