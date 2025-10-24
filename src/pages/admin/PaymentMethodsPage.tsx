import React, { useEffect, useState } from 'react';
import { supabase, PaymentMethod } from '../../lib/supabase';
import { Plus, Trash2, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState('');
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
          .from('payment_methods')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('display_order', { ascending: true });

        if (data) {
          setMethods(data);
        }
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!businessId || !newMethod.trim()) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert([{
          business_id: businessId,
          method_name: newMethod,
          is_active: true,
          display_order: methods.length
        }]);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Payment method added!' });
      setNewMethod('');
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding:', error);
      setMessage({ type: 'error', text: 'Failed to add payment method' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment method?')) return;

    try {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Payment method deleted!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete payment method' });
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Payment Methods</h1>
        <p className="text-slate-600">Manage accepted payment methods</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          Add Payment Method
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
            placeholder="e.g., Cash, Venmo, Zelle"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newMethod.trim()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Current Payment Methods</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {methods.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              No payment methods added yet
            </div>
          ) : (
            methods.map((method) => (
              <div key={method.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <span className="font-medium text-slate-900">{method.method_name}</span>
                <button
                  onClick={() => handleDelete(method.id)}
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
