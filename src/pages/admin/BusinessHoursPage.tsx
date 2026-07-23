import { useEffect, useState } from 'react';
import { supabase, BusinessHours } from '../../lib/supabase';
import { Save, Clock, AlertCircle, CheckCircle, Link2 } from 'lucide-react';
import { syncGoogleBusinessProfile } from '../../services/googleBusinessSyncService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function BusinessHoursPage() {
  const [hours, setHours] = useState<BusinessHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
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
          .from('business_hours')
          .select('*')
          .eq('business_id', businessInfo.id);

        if (data) {
          const hoursMap = new Map(data.map(h => [h.day_of_week, h]));
          const allHours = DAYS.map(day =>
            hoursMap.get(day) || {
              id: '',
              business_id: businessInfo.id,
              day_of_week: day,
              opens: '09:00',
              closes: '17:00',
              is_closed: false,
              created_at: '',
              updated_at: ''
            } as BusinessHours
          );
          setHours(allHours);
        }
      }
    } catch (error) {
      console.error('Error fetching hours:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);

    try {
      for (const hour of hours) {
        if (hour.id) {
          await supabase
            .from('business_hours')
            .update({
              opens: hour.is_closed ? null : hour.opens,
              closes: hour.is_closed ? null : hour.closes,
              is_closed: hour.is_closed
            })
            .eq('id', hour.id);
        } else {
          await supabase
            .from('business_hours')
            .insert([{
              business_id: businessId,
              day_of_week: hour.day_of_week,
              opens: hour.is_closed ? null : hour.opens,
              closes: hour.is_closed ? null : hour.closes,
              is_closed: hour.is_closed
            }]);
        }
      }
      const googleResult = await syncGoogleBusinessProfile().catch((err) => ({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync to Google.',
      }));
      const googleNote = googleResult.success
        ? ' Google Business Profile updated.'
        : ` Google Business Profile sync: ${googleResult.error ?? 'failed'}.`;

      setMessage({ type: 'success', text: `Business hours saved! Refresh your public site to see the changes.${googleNote}` });
      setTimeout(() => setMessage(null), 8000);
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save business hours' });
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (index: number, field: keyof BusinessHours, value: any) => {
    const updated = [...hours];
    updated[index] = { ...updated[index], [field]: value };
    setHours(updated);
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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Business Hours</h1>
        <p className="text-sm sm:text-base text-slate-600">Set your operating hours for each day</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Weekly Schedule
          </h2>
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Link2 className="w-3 h-3 flex-shrink-0" />
            These hours sync to Google Business Profile as a whole when you save.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {hours.map((hour, index) => (
            <div key={hour.day_of_week} className="flex items-center gap-4">
              <div className="w-32">
                <span className="font-medium text-slate-900">{hour.day_of_week}</span>
              </div>
              <div className="flex items-center gap-4 flex-1">
                <input name="opens"
                  type="time"
                  value={hour.opens || ''}
                  onChange={(e) => updateHour(index, 'opens', e.target.value)}
                  disabled={hour.is_closed}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                />
                <span className="text-slate-500">to</span>
                <input name="closes"
                  type="time"
                  value={hour.closes || ''}
                  onChange={(e) => updateHour(index, 'closes', e.target.value)}
                  disabled={hour.is_closed}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                />
                <label className="flex items-center gap-2 ml-4">
                  <input name="is_closed"
                    type="checkbox"
                    checked={hour.is_closed}
                    onChange={(e) => updateHour(index, 'is_closed', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Closed</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 sm:mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Hours'}
        </button>
      </div>
    </div>
  );
}
