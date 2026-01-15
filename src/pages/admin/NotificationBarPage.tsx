import React, { useEffect, useState } from 'react';
import { supabase, NotificationBar, getNotificationBarSettings } from '../../lib/supabase';
import { Save, AlertCircle, CheckCircle, Bell, Eye, EyeOff, Zap } from 'lucide-react';

export default function NotificationBarPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [settings, setSettings] = useState<Partial<NotificationBar>>({
    message: '',
    background_color: '#3B82F6',
    text_color: '#FFFFFF',
    is_enabled: false,
    enable_scroll_animation: false,
    scroll_speed: 'medium',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: businessData } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (businessData) {
        setBusinessId(businessData.id);
        const notificationData = await getNotificationBarSettings(businessData.id);

        if (notificationData) {
          setSettings(notificationData);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load notification bar settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) {
      setMessage({ type: 'error', text: 'Business ID not found' });
      return;
    }

    if (!settings.message?.trim()) {
      setMessage({ type: 'error', text: 'Please enter a message' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (settings.id) {
        const { error: updateError } = await supabase
          .from('notification_bar')
          .update({
            message: settings.message,
            background_color: settings.background_color,
            text_color: settings.text_color,
            is_enabled: settings.is_enabled,
            enable_scroll_animation: settings.enable_scroll_animation,
            scroll_speed: settings.scroll_speed,
          })
          .eq('id', settings.id);

        if (updateError) throw updateError;
      } else {
        const { data: newNotification, error: insertError } = await supabase
          .from('notification_bar')
          .insert([{
            business_id: businessId,
            message: settings.message,
            background_color: settings.background_color,
            text_color: settings.text_color,
            is_enabled: settings.is_enabled,
            enable_scroll_animation: settings.enable_scroll_animation,
            scroll_speed: settings.scroll_speed,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newNotification);
      }

      setMessage({ type: 'success', text: 'Notification bar settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save notification bar settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (field: 'background_color' | 'text_color', value: string) => {
    setSettings({ ...settings, [field]: value });
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Notification Bar</h1>
        <p className="text-slate-600">Manage site-wide announcements and special messages</p>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Notification Settings
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input name="is_enabled"
                type="checkbox"
                checked={settings.is_enabled || false}
                onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2">
                {settings.is_enabled ? (
                  <Eye className="w-5 h-5 text-emerald-600" />
                ) : (
                  <EyeOff className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {settings.is_enabled ? 'Notification bar is enabled' : 'Notification bar is disabled'}
                </span>
              </div>
            </label>
            <p className="text-sm text-slate-500 mt-2 ml-8">
              Toggle to show or hide the notification bar on your website
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message *
            </label>
            <textarea name="message"
              value={settings.message || ''}
              onChange={(e) => setSettings({ ...settings, message: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your notification message (e.g., 'Special offer: 20% off all services this week!')"
              required
            />
            <p className="text-sm text-slate-500 mt-1">
              This message will appear at the top of your website
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Background Color
              </label>
              <div className="flex gap-3 items-center">
                <input name="background_color"
                  type="color"
                  value={settings.background_color || '#3B82F6'}
                  onChange={(e) => handleColorChange('background_color', e.target.value)}
                  className="w-16 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input name="background_color"
                  type="text"
                  value={settings.background_color || '#3B82F6'}
                  onChange={(e) => handleColorChange('background_color', e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                  placeholder="#3B82F6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Text Color
              </label>
              <div className="flex gap-3 items-center">
                <input name="text_color"
                  type="color"
                  value={settings.text_color || '#FFFFFF'}
                  onChange={(e) => handleColorChange('text_color', e.target.value)}
                  className="w-16 h-10 border border-slate-300 rounded cursor-pointer"
                />
                <input name="text_color"
                  type="text"
                  value={settings.text_color || '#FFFFFF'}
                  onChange={(e) => handleColorChange('text_color', e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Animation Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input name="enable_scroll_animation"
                    type="checkbox"
                    checked={settings.enable_scroll_animation || false}
                    onChange={(e) => setSettings({ ...settings, enable_scroll_animation: e.target.checked })}
                    className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Enable Scrolling Animation
                    </span>
                  </div>
                </label>
                <p className="text-sm text-slate-500 mt-2 ml-8">
                  Creates a continuous scrolling effect to catch visitors' attention
                </p>
              </div>

              {settings.enable_scroll_animation && (
                <div className="ml-8">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Animation Speed
                  </label>
                  <div className="flex gap-4">
                    {(['slow', 'medium', 'fast'] as const).map((speed) => (
                      <label key={speed} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scroll_speed"
                          value={speed}
                          checked={settings.scroll_speed === speed}
                          onChange={(e) => setSettings({ ...settings, scroll_speed: e.target.value as 'slow' | 'medium' | 'fast' })}
                          className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700 capitalize">{speed}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Slow: 20s per cycle | Medium: 12s per cycle | Fast: 8s per cycle
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Preview</h3>
            <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
              <style>
                {`
                  @keyframes preview-scroll {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                  .preview-scroll-slow { animation: preview-scroll 20s linear infinite; }
                  .preview-scroll-medium { animation: preview-scroll 12s linear infinite; }
                  .preview-scroll-fast { animation: preview-scroll 8s linear infinite; }
                `}
              </style>
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{
                  backgroundColor: settings.background_color || '#3B82F6',
                  color: settings.text_color || '#FFFFFF',
                }}
              >
                <div className="flex-1 relative overflow-hidden">
                  {settings.enable_scroll_animation ? (
                    <div className="flex justify-start">
                      <p className={`text-sm sm:text-base font-medium whitespace-nowrap preview-scroll-${settings.scroll_speed || 'medium'}`}>
                        {settings.message || 'Your notification message will appear here...'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base font-medium text-center">
                      {settings.message || 'Your notification message will appear here...'}
                    </p>
                  )}
                </div>
                <button
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors ml-4"
                  disabled
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
