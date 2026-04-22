import React, { useEffect, useState } from 'react';
import { supabase, PaymentMethod } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2, CreditCard, CheckCircle, AlertCircle, AlertTriangle, Zap, ArrowRightLeft } from 'lucide-react';

type StripeMode = 'live' | 'test';

export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [stripeMode, setStripeMode] = useState<StripeMode>('live');
  const [stripeUpdatedAt, setStripeUpdatedAt] = useState<string | null>(null);
  const [stripeUpdatedBy, setStripeUpdatedBy] = useState<string | null>(null);
  const [stripeSaving, setStripeSaving] = useState(false);

  const fetchOrganizationId = async (activeBusinessId: string): Promise<string | null> => {
    const { data: businessData, error: businessError } = await supabase
      .from('business_info')
      .select('organization_id')
      .eq('id', activeBusinessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (businessData?.organization_id) return businessData.organization_id;

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (orgError) throw orgError;
    return orgData?.id ?? null;
  };

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

        const resolvedOrganizationId = await fetchOrganizationId(businessInfo.id);
        setOrganizationId(resolvedOrganizationId);

        const { data } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('business_id', businessInfo.id)
          .order('display_order', { ascending: true });

        if (data) {
          setMethods(data);
        }

        const { data: stripeSettings } = await supabase
          .from('stripe_settings')
          .select('stripe_mode, updated_at, updated_by')
          .eq('business_id', businessInfo.id)
          .maybeSingle();

        if (stripeSettings) {
          setStripeMode(stripeSettings.stripe_mode as StripeMode);
          setStripeUpdatedAt(stripeSettings.updated_at);
          setStripeUpdatedBy(stripeSettings.updated_by || null);
        }
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStripeMode = async () => {
    if (!businessId) return;

    const newMode: StripeMode = stripeMode === 'live' ? 'test' : 'live';

    const confirmMsg = newMode === 'test'
      ? 'Switch to TEST mode? No real charges will be processed. All payment flows (invoices, gift cards, subscriptions) will use Stripe test keys.'
      : 'Switch to LIVE mode? Real charges will be processed for all payment flows.';

    if (!confirm(confirmMsg)) return;

    setStripeSaving(true);
    try {
      const resolvedOrgId = organizationId ?? await fetchOrganizationId(businessId);
      const now = new Date().toISOString();
      const adminEmail = user?.email || '';

      const { error } = await supabase
        .from('stripe_settings')
        .upsert({
          business_id: businessId,
          organization_id: resolvedOrgId,
          stripe_mode: newMode,
          updated_at: now,
          updated_by: adminEmail,
        }, { onConflict: 'business_id' });

      if (error) throw error;

      setStripeMode(newMode);
      setStripeUpdatedAt(now);
      setStripeUpdatedBy(adminEmail);
      setMessage({
        type: 'success',
        text: `Stripe switched to ${newMode.toUpperCase()} mode`,
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      console.error('Error updating Stripe mode:', error);
      setMessage({ type: 'error', text: 'Failed to update Stripe mode' });
    } finally {
      setStripeSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!businessId || !newMethod.trim()) return;

    try {
      const resolvedOrganizationId = organizationId ?? await fetchOrganizationId(businessId);
      if (!resolvedOrganizationId) {
        throw new Error('Unable to resolve organization context for payment methods');
      }

      const { error } = await supabase
        .from('payment_methods')
        .insert([{
          business_id: businessId,
          organization_id: resolvedOrganizationId,
          method_name: newMethod,
          is_active: true,
          display_order: methods.length
        }]);

      if (error) throw error;
      if (!organizationId) setOrganizationId(resolvedOrganizationId);
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

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const isTestMode = stripeMode === 'test';

  return (
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Payment Methods</h1>
        <p className="text-sm sm:text-base text-slate-600">Manage accepted payment methods and Stripe configuration</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {/* Stripe Mode Section */}
      <div className={`rounded-xl border-2 p-6 mb-6 transition-colors ${isTestMode ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Zap className={`w-5 h-5 ${isTestMode ? 'text-amber-600' : 'text-emerald-600'}`} />
              Stripe Environment
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Controls which Stripe keys are used for all payment flows including invoices, gift cards, and subscriptions.
            </p>

            <div className={`flex items-start gap-2 p-3 border rounded-lg mb-4 ${isTestMode ? 'bg-amber-100 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
              {isTestMode ? (
                <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`text-sm font-semibold ${isTestMode ? 'text-amber-800' : 'text-emerald-800'}`}>
                  Current Environment: {isTestMode ? 'TEST MODE' : 'LIVE MODE'}
                </p>
                <p className={`text-sm ${isTestMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isTestMode
                    ? 'No real charges will be processed. Use Stripe test cards (e.g., 4242 4242 4242 4242) to simulate payments.'
                    : 'Real customer charges are enabled. All payment flows use your Stripe live keys.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isTestMode ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                {isTestMode ? 'Current: TEST (no real charges)' : 'Current: LIVE (real charges)'}
              </div>

              <button
                onClick={handleToggleStripeMode}
                disabled={stripeSaving}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${isTestMode ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm">
                  {stripeSaving
                    ? 'Switching...'
                    : isTestMode
                      ? 'Switch to LIVE mode'
                      : 'Switch to TEST mode'}
                </span>
              </button>
            </div>

            {stripeUpdatedAt && (
              <p className="text-xs text-slate-500 mt-3">
                Last changed: {formatDate(stripeUpdatedAt)}
                {stripeUpdatedBy && ` by ${stripeUpdatedBy}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          Add Payment Method
        </h2>
        <div className="flex gap-3">
          <input name="newMethod"
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
