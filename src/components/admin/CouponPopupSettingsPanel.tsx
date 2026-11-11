import { useState } from 'react';
import { AppWindow, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { couponState, describeStateDetail } from '../../utils/coupon';
import {
  POPUP_CTA_MAX_LENGTH, POPUP_DELAY_MAX_SECONDS, POPUP_FADE_MAX_MS, normalizePopupSettings, pickHomeCoupon,
  type CouponPopupFrequency, type CouponPopupPosition, type CouponPopupSettings,
} from '../../utils/couponPopup';
import type { Coupon } from '../../types/coupon';

interface CouponPopupSettingsPanelProps {
  settings: CouponPopupSettings;
  coupons: Coupon[];
  saving: boolean;
  onSave: (settings: CouponPopupSettings) => void;
  /** Show the popup exactly as a visitor would see it, with these unsaved settings. */
  onPreview: (settings: CouponPopupSettings) => void;
}

const FREQUENCIES: { value: CouponPopupFrequency; label: string; hint: string }[] = [
  { value: 'once_per_coupon', label: 'Once per coupon', hint: 'A visitor sees each coupon one time. A new coupon shows again.' },
  { value: 'once_per_day', label: 'Once a day', hint: 'A returning visitor sees it again after 24 hours.' },
  { value: 'every_visit', label: 'Every visit', hint: 'Shows each time someone lands on the home page.' },
];

const POSITIONS: { value: CouponPopupPosition; label: string; hint: string }[] = [
  { value: 'center', label: 'Centre of the screen', hint: 'Dims the page behind it. Hardest to miss.' },
  { value: 'corner', label: 'Bottom corner', hint: 'Sits over the corner and leaves the page usable.' },
];

/**
 * The home page popup's controls, on the coupons page because that is where
 * the codes it shows are chosen. Collapsed it is one line saying what visitors
 * are seeing right now; opened it is the timing, the fade and the rest.
 */
export default function CouponPopupSettingsPanel({
  settings, coupons, saving, onSave, onPreview,
}: CouponPopupSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);
  // Saved settings arriving (first load, or a save) replace whatever was typed.
  const [base, setBase] = useState(settings);
  if (base !== settings) {
    setBase(settings);
    setDraft(settings);
  }

  const showing = pickHomeCoupon(coupons);
  const ticked = coupons.filter((c) => c.show_on_home);
  const upcoming = ticked
    .filter((c) => couponState(c) === 'scheduled' && c.starts_at)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];

  const dirty = JSON.stringify(normalizePopupSettings(draft)) !== JSON.stringify(normalizePopupSettings(settings));

  let status: React.ReactNode;
  if (!settings.is_enabled) {
    status = 'Switched off. No coupon pops up on your home page.';
  } else if (showing) {
    status = (
      <>
        Visitors are seeing <strong className="font-mono tracking-wide text-slate-900">{showing.code}</strong> right now.
      </>
    );
  } else if (upcoming) {
    status = (
      <>
        Nothing showing right now. <strong className="font-mono tracking-wide text-slate-900">{upcoming.code}</strong>{' '}
        {describeStateDetail(upcoming, 'scheduled').toLowerCase()}.
      </>
    );
  } else if (ticked.length > 0) {
    status = 'Nothing showing right now. None of the coupons you ticked is live.';
  } else {
    status = 'No coupon is ticked yet. Edit a coupon and tick “Show on home page”.';
  }

  const inputClass =
    'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';

  return (
    <section
      aria-label="Home page popup"
      className="mb-6 bg-white rounded-xl border border-slate-200"
      data-testid="coupon-popup-settings"
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`shrink-0 p-2 rounded-lg ${settings.is_enabled && showing ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <AppWindow className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Home page popup</h2>
            <p className="text-sm text-slate-600" data-testid="coupon-popup-status">{status}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              role="switch"
              name="popup_enabled"
              checked={settings.is_enabled}
              onChange={(e) => onSave({ ...settings, is_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            {settings.is_enabled ? 'On' : 'Off'}
          </label>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Popup settings
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label htmlFor="popup-delay" className="block text-sm font-medium text-slate-700 mb-2">
                Wait before showing
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="popup-delay"
                  name="delay_seconds"
                  type="number"
                  min="0"
                  max={POPUP_DELAY_MAX_SECONDS}
                  step="0.5"
                  value={draft.delay_seconds}
                  onChange={(e) => setDraft({ ...draft, delay_seconds: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className={`${inputClass} max-w-[7rem]`}
                />
                <span className="text-sm text-slate-600">seconds</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Counted from when the opening box animation finishes. 0 shows it straight away.
              </p>
            </div>

            <div>
              <label htmlFor="popup-fade" className="block text-sm font-medium text-slate-700 mb-2">
                Fade-in speed
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="popup-fade"
                  name="fade_ms"
                  type="range"
                  min="0"
                  max={POPUP_FADE_MAX_MS}
                  step="100"
                  value={draft.fade_ms}
                  onChange={(e) => setDraft({ ...draft, fade_ms: Number(e.target.value) })}
                  className="flex-1 accent-emerald-600"
                />
                <span className="w-24 text-sm text-slate-600 tabular-nums">
                  {draft.fade_ms === 0 ? 'Instant' : `${(draft.fade_ms / 1000).toFixed(1)} seconds`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                How long the fade takes. Visitors who ask their device for less motion always get it instantly.
              </p>
            </div>

            <div>
              <label htmlFor="popup-frequency" className="block text-sm font-medium text-slate-700 mb-2">
                How often one visitor sees it
              </label>
              <select
                id="popup-frequency"
                name="frequency"
                value={draft.frequency}
                onChange={(e) => setDraft({ ...draft, frequency: e.target.value as CouponPopupFrequency })}
                className={inputClass}
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {FREQUENCIES.find((option) => option.value === draft.frequency)?.hint}
              </p>
            </div>

            <div>
              <label htmlFor="popup-cta" className="block text-sm font-medium text-slate-700 mb-2">
                Button text
              </label>
              <input
                id="popup-cta"
                name="cta_label"
                value={draft.cta_label}
                maxLength={POPUP_CTA_MAX_LENGTH}
                onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                placeholder="Claim my discount"
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                Pressing it takes the visitor to your quote form with the code already applied.
              </p>
            </div>

            <fieldset className="md:col-span-2">
              <legend className="block text-sm font-medium text-slate-700 mb-2">Where it appears</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POSITIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      draft.position === option.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="position"
                      value={option.value}
                      checked={draft.position === option.value}
                      onChange={() => setDraft({ ...draft, position: option.value })}
                      className="mt-0.5 w-4 h-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium">{option.label}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => onPreview(normalizePopupSettings(draft))}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving || !dirty}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save popup settings'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
