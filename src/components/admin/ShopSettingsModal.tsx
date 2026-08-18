import React, { useState } from 'react';
import { AlertCircle, Loader2, Plus, Save, X } from 'lucide-react';
import { centsToDollarsInput, parseDollarsToCents, saveShopSettings } from '../../services/shopService';
import type { ShopSettings } from '../../types/shop';

interface ShopSettingsModalProps {
  businessId: string;
  settings: ShopSettings | null;
  onSaved: (settings: ShopSettings) => void;
  onCancel: () => void;
}

const ShopSettingsModal: React.FC<ShopSettingsModalProps> = ({
  businessId,
  settings,
  onSaved,
  onCancel,
}) => {
  const [announcement, setAnnouncement] = useState(settings?.announcement ?? '');
  const [shippingEnabled, setShippingEnabled] = useState(settings?.shipping_enabled ?? true);
  const [flatShipping, setFlatShipping] = useState(
    centsToDollarsInput(settings?.flat_shipping_cents ?? 700),
  );
  const [freeThreshold, setFreeThreshold] = useState(
    settings?.free_shipping_threshold_cents === null ||
      settings?.free_shipping_threshold_cents === undefined
      ? ''
      : centsToDollarsInput(settings.free_shipping_threshold_cents),
  );
  const [pickupEnabled, setPickupEnabled] = useState(settings?.local_pickup_enabled ?? true);
  const [pickupInstructions, setPickupInstructions] = useState(settings?.pickup_instructions ?? '');
  const [taxRate, setTaxRate] = useState(String(settings?.tax_rate_percent ?? 0));
  const [materialOptions, setMaterialOptions] = useState<string[]>(settings?.material_options ?? []);
  const [colorOptions, setColorOptions] = useState<string[]>(settings?.color_options ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);

    const flatCents = parseDollarsToCents(flatShipping || '0');
    if (flatCents === null) {
      setError('Flat shipping needs to be a dollar amount.');
      return;
    }

    const thresholdCents = freeThreshold.trim() ? parseDollarsToCents(freeThreshold) : null;
    if (freeThreshold.trim() && thresholdCents === null) {
      setError('Free-shipping threshold needs to be a dollar amount.');
      return;
    }

    const rate = Number(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError('Sales tax must be between 0 and 100 percent.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveShopSettings(businessId, {
        material_options: materialOptions,
        color_options: colorOptions,
        announcement: announcement.trim() || null,
        shipping_enabled: shippingEnabled,
        flat_shipping_cents: flatCents,
        free_shipping_threshold_cents: thresholdCents,
        local_pickup_enabled: pickupEnabled,
        pickup_instructions: pickupInstructions.trim() || null,
        tax_rate_percent: rate,
      });
      onSaved(saved);
    } catch (saveError) {
      console.error('Failed to save store settings:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Store settings</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="shop_announcement" className={labelClass}>
              Store banner <span className="font-normal text-slate-400">optional</span>
            </label>
            <textarea
              id="shop_announcement"
              rows={2}
              value={announcement}
              onChange={(event) => setAnnouncement(event.target.value)}
              className={inputClass}
              placeholder="Holiday orders placed after Dec 15 ship in January."
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={shippingEnabled}
              onChange={(event) => setShippingEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-sm font-medium text-slate-800">Offer shipping</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="shop_flat_shipping" className={labelClass}>
                Flat shipping ($)
              </label>
              <input
                id="shop_flat_shipping"
                value={flatShipping}
                onChange={(event) => setFlatShipping(event.target.value)}
                className={inputClass}
                inputMode="decimal"
              />
            </div>
            <div>
              <label htmlFor="shop_free_threshold" className={labelClass}>
                Free over ($) <span className="font-normal text-slate-400">blank = never</span>
              </label>
              <input
                id="shop_free_threshold"
                value={freeThreshold}
                onChange={(event) => setFreeThreshold(event.target.value)}
                className={inputClass}
                inputMode="decimal"
                placeholder="75.00"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={pickupEnabled}
              onChange={(event) => setPickupEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-sm font-medium text-slate-800">Offer local pickup</span>
          </label>

          <div>
            <label htmlFor="shop_pickup" className={labelClass}>
              Pickup instructions
            </label>
            <textarea
              id="shop_pickup"
              rows={2}
              value={pickupInstructions}
              onChange={(event) => setPickupInstructions(event.target.value)}
              className={inputClass}
              placeholder="We'll email you to arrange a pickup time in Spring Hill."
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Filament on hand</p>
            <p className="mt-0.5 text-xs text-slate-500">
              These fill the Material and Color dropdowns when you add a product.
            </p>

            <div className="mt-4 space-y-4">
              <OptionList
                label="Materials"
                placeholder="PETG"
                values={materialOptions}
                onChange={setMaterialOptions}
              />
              <OptionList
                label="Colors"
                placeholder="Matte Black"
                values={colorOptions}
                onChange={setColorOptions}
              />
            </div>
          </div>

          <div className="max-w-[10rem]">
            <label htmlFor="shop_tax" className={labelClass}>
              Sales tax (%)
            </label>
            <input
              id="shop_tax"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              className={inputClass}
              inputMode="decimal"
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave at 0 until you're registered to collect it.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Chip editor for one filament list. Removing a value only takes it out of
 * future dropdowns — products already using it keep their own copy.
 */
const OptionList: React.FC<{
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}> = ({ label, placeholder, values, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.some((value) => value.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-600">{label}</p>

      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm text-slate-700"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600"
                aria-label={`Remove ${value}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
};

export default ShopSettingsModal;
