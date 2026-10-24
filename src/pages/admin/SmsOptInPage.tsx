import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';

export default function SmsOptInPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('business_info')
          .select('id, sms_opt_in_enabled')
          .eq('is_active', true)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setBusinessId(data.id);
          setEnabled(data.sms_opt_in_enabled !== false);
        }
      } catch (error) {
        console.error('Error loading SMS opt-in setting:', error);
        setMessage({ type: 'error', text: 'Failed to load the SMS opt-in setting' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = async () => {
    if (!businessId) return;
    const next = !enabled;
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('business_info')
        .update({ sms_opt_in_enabled: next })
        .eq('id', businessId);
      if (error) throw error;
      setEnabled(next);
      setMessage({
        type: 'success',
        text: next ? 'SMS opt-in is now showing on the service form.' : 'SMS opt-in is now hidden from the service form.',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving SMS opt-in setting:', error);
      setMessage({ type: 'error', text: 'Failed to save the SMS opt-in setting' });
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">SMS Opt-In</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Show or hide the text-message consent checkboxes on the service request form
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            Service form text consent
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700">
                {enabled ? 'SMS opt-in is on' : 'SMS opt-in is off'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                When off, customers do not see the checkboxes and no text consent is recorded. Consent
                already collected stays saved on each request.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle SMS opt-in on the service form"
              onClick={handleToggle}
              disabled={saving || !businessId}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                enabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
