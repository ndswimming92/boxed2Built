import React, { useEffect, useState } from 'react';
import { supabase, BusinessAttribute } from '../../lib/supabase';
import { Plus, Trash2, Settings, CheckCircle, AlertCircle } from 'lucide-react';

export default function AttributesPage() {
  const [attributes, setAttributes] = useState<BusinessAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          .from('business_attributes')
          .select('*')
          .eq('business_id', businessInfo.id);

        if (data) {
          setAttributes(data);
        }
      }
    } catch (error) {
      console.error('Error fetching attributes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!businessId || !newAttrName.trim() || !newAttrValue.trim()) return;

    try {
      const { error } = await supabase
        .from('business_attributes')
        .insert([{
          business_id: businessId,
          attribute_name: newAttrName,
          attribute_value: newAttrValue
        }]);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Attribute added!' });
      setNewAttrName('');
      setNewAttrValue('');
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding:', error);
      setMessage({ type: 'error', text: 'Failed to add attribute' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this attribute?')) return;

    try {
      const { error } = await supabase.from('business_attributes').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Attribute deleted!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete attribute' });
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
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Business Attributes</h1>
        <p className="text-slate-600">Add custom key-value pairs for your business</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          Add Attribute
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input name="newAttrName"
            type="text"
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            placeholder="Attribute name (e.g., Licenses)"
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
          <input name="newAttrValue"
            type="text"
            value={newAttrValue}
            onChange={(e) => setNewAttrValue(e.target.value)}
            placeholder="Attribute value (e.g., Licensed & Insured)"
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newAttrName.trim() || !newAttrValue.trim()}
          className="w-full md:w-auto px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Add Attribute
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Current Attributes</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {attributes.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              No attributes added yet
            </div>
          ) : (
            attributes.map((attr) => (
              <div key={attr.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900">{attr.attribute_name}</p>
                  <p className="text-sm text-slate-600">{attr.attribute_value}</p>
                </div>
                <button
                  onClick={() => handleDelete(attr.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
