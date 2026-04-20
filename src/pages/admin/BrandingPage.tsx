import { useEffect, useMemo, useState } from 'react';
import { Palette, Save, RefreshCw, Smartphone } from 'lucide-react';
import { useAdminBranding } from '../../hooks/useAdminBranding';
import { buildAdminIconDataUrl, updateAdminBranding } from '../../services/brandingService';
import { updateManifest } from '../../utils/manifestManager';

const PRESETS: Array<{ label: string; color: string }> = [
  { label: 'Navy', color: '#1E3A8A' },
  { label: 'Midnight', color: '#0F172A' },
  { label: 'Slate', color: '#334155' },
  { label: 'Ocean', color: '#0369A1' },
  { label: 'Forest', color: '#065F46' },
  { label: 'Crimson', color: '#991B1B' },
  { label: 'Amber', color: '#B45309' },
  { label: 'Charcoal', color: '#111827' },
];

export default function BrandingPage() {
  const { branding, loading, error, refresh } = useAdminBranding();
  const [themeColor, setThemeColor] = useState('#1E3A8A');
  const [markColor, setMarkColor] = useState('#FFFFFF');
  const [markText, setMarkText] = useState('Admin');
  const [title, setTitle] = useState('Boxed2Built Admin');
  const [shortName, setShortName] = useState('B2B Admin');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (branding) {
      setThemeColor(branding.theme_color);
      setMarkColor(branding.mark_color);
      setMarkText(branding.mark_text);
      setTitle(branding.title);
      setShortName(branding.short_name);
    }
  }, [branding]);

  const previewIcon = useMemo(
    () => buildAdminIconDataUrl(themeColor, markColor, markText),
    [themeColor, markColor, markText]
  );

  const handleSave = async () => {
    if (!branding?.id) {
      setSaveMessage('Branding row not loaded yet. Try again in a moment.');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateAdminBranding(branding.id, {
        theme_color: themeColor,
        mark_color: markColor,
        mark_text: markText,
        title,
        short_name: shortName,
      });
      updateManifest(true);
      setSaveMessage('Branding saved. Re-add the admin tile to your Home Screen to see the new icon.');
      await refresh(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save branding';
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !branding) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Loading branding...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center text-white">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Branding</h1>
            <p className="text-sm text-slate-500">Customize the color and mark shown on your iPhone Home Screen and browser tab.</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tile Background Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-14 h-14 rounded-lg border border-slate-300 cursor-pointer"
                aria-label="Tile background color"
              />
              <input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="#1E3A8A"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setThemeColor(preset.color)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    themeColor.toLowerCase() === preset.color.toLowerCase()
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/40"
                    style={{ backgroundColor: preset.color }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mark Text Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={markColor}
                onChange={(e) => setMarkColor(e.target.value)}
                className="w-14 h-14 rounded-lg border border-slate-300 cursor-pointer"
                aria-label="Mark text color"
              />
              <input
                type="text"
                value={markColor}
                onChange={(e) => setMarkColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mark Text</label>
            <input
              type="text"
              value={markText}
              maxLength={16}
              onChange={(e) => setMarkText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="Admin"
            />
            <p className="mt-1 text-xs text-slate-500">Shown large on the Home Screen tile. Up to 16 characters.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="Boxed2Built Admin"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Short Name</label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="B2B Admin"
              />
              <p className="mt-1 text-xs text-slate-500">Label under the Home Screen icon.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
            {saveMessage && <span className="text-sm text-slate-600">{saveMessage}</span>}
          </div>
        </section>

        <section className="bg-slate-100 rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-700">
            <Smartphone className="w-4 h-4" />
            <span className="text-sm font-semibold">Home Screen Preview</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-slate-200 rounded-2xl py-10">
            <div className="w-32 h-32 rounded-[28px] shadow-xl overflow-hidden">
              <img src={previewIcon} alt="Admin icon preview" className="w-full h-full" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">{shortName || 'Admin'}</p>
          </div>
          <div className="mt-6 text-xs text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">How to add to iPhone Home Screen</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open <code className="px-1 bg-white rounded">/admin/dashboard</code> in Safari.</li>
              <li>Tap the Share button, then "Add to Home Screen".</li>
              <li>Confirm the name is "{shortName}" and tap Add.</li>
              <li>Launch from Home Screen - opens directly to the Admin Dashboard.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
