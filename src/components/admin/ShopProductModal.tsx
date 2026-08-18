import React, { useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, Save, Trash2, X } from 'lucide-react';
import {
  centsToDollarsInput,
  createProduct,
  parseDollarsToCents,
  slugify,
  updateProduct,
  uploadProductImage,
} from '../../services/shopService';
import { validateImageFile } from '../../utils/imageOptimizationUpload';
import type { ProductDraft, ShopProduct } from '../../types/shop';

interface ShopProductModalProps {
  businessId: string;
  product?: ShopProduct;
  categories: string[];
  /** Filament lists from Store settings, shown in the Material/Color dropdowns. */
  materialOptions: string[];
  colorOptions: string[];
  /** Persists a filament added from this form back to Store settings. */
  onAddFilamentOption: (kind: 'material' | 'color', value: string) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}

type FormState = {
  name: string;
  slug: string;
  category: string;
  short_description: string;
  description: string;
  price: string;
  compare_at_price: string;
  material: string;
  color: string;
  lead_time_days: string;
  max_per_order: string;
  track_inventory: boolean;
  stock_quantity: string;
  requires_shipping: boolean;
  allow_local_pickup: boolean;
  is_active: boolean;
  is_featured: boolean;
  display_order: string;
};

function initialState(product?: ShopProduct): FormState {
  return {
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    category: product?.category ?? 'Home & Organization',
    short_description: product?.short_description ?? '',
    description: product?.description ?? '',
    price: centsToDollarsInput(product?.price_cents ?? 0),
    compare_at_price: centsToDollarsInput(product?.compare_at_price_cents ?? null),
    material: product?.material ?? '',
    color: product?.color ?? '',
    lead_time_days: String(product?.lead_time_days ?? 3),
    max_per_order: String(product?.max_per_order ?? 10),
    track_inventory: product?.track_inventory ?? false,
    stock_quantity: String(product?.stock_quantity ?? 0),
    requires_shipping: product?.requires_shipping ?? true,
    allow_local_pickup: product?.allow_local_pickup ?? true,
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
    display_order: String(product?.display_order ?? 0),
  };
}

const ShopProductModal: React.FC<ShopProductModalProps> = ({
  businessId,
  product,
  categories,
  materialOptions,
  colorOptions,
  onAddFilamentOption,
  onSaved,
  onCancel,
}) => {
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(() => initialState(product));
  const [primaryImage, setPrimaryImage] = useState<string | null>(product?.image_url ?? null);
  const [extraImages, setExtraImages] = useState<string[]>(product?.image_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
      // Keep the slug in step with the name until the product exists; editing a
      // live product leaves its slug alone so shared links keep working.
      slug: isEdit ? current.slug : slugify(value),
    }));
  };

  const handleUpload = async (files: FileList | null, target: 'primary' | 'extra') => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setError(validation.error ?? 'That file is not a supported image.');
          continue;
        }
        uploaded.push(await uploadProductImage(file, businessId));
      }

      if (target === 'primary' && uploaded[0]) {
        setPrimaryImage(uploaded[0]);
        if (uploaded.length > 1) setExtraImages((current) => [...current, ...uploaded.slice(1)]);
      } else if (uploaded.length > 0) {
        setExtraImages((current) => [...current, ...uploaded]);
      }
    } catch (uploadError) {
      console.error('Product image upload failed:', uploadError);
      setError('Upload failed. Please try that photo again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError(null);

    const priceCents = parseDollarsToCents(form.price);
    if (!form.name.trim()) {
      setError('Give the product a name.');
      return;
    }
    if (priceCents === null) {
      setError('Enter a price like 24 or 24.50.');
      return;
    }

    const compareCents = form.compare_at_price.trim()
      ? parseDollarsToCents(form.compare_at_price)
      : null;
    if (form.compare_at_price.trim() && compareCents === null) {
      setError('The "compare at" price needs to be a dollar amount.');
      return;
    }

    const slug = slugify(form.slug || form.name);
    if (!slug) {
      setError('That name needs at least one letter or number for the web address.');
      return;
    }

    const draft: ProductDraft = {
      name: form.name.trim(),
      slug,
      category: form.category.trim() || 'Other',
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      price_cents: priceCents,
      compare_at_price_cents: compareCents,
      material: form.material.trim() || null,
      color: form.color.trim() || null,
      lead_time_days: Math.max(0, Number(form.lead_time_days) || 0),
      image_url: primaryImage,
      image_urls: extraImages,
      track_inventory: form.track_inventory,
      stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
      max_per_order: Math.max(1, Number(form.max_per_order) || 1),
      requires_shipping: form.requires_shipping,
      allow_local_pickup: form.allow_local_pickup,
      is_active: form.is_active,
      is_featured: form.is_featured,
      display_order: Number(form.display_order) || 0,
    };

    setSaving(true);
    try {
      if (isEdit && product) {
        await updateProduct(product.id, draft);
      } else {
        await createProduct(businessId, draft);
      }
      onSaved();
    } catch (saveError) {
      console.error('Failed to save product:', saveError);
      const message = saveError instanceof Error ? saveError.message : 'Failed to save product.';
      setError(
        /duplicate key|unique/i.test(message)
          ? 'Another product already uses that web address (slug). Try a different one.'
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit product' : 'Add a product'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Photos */}
          <div>
            <p className={labelClass}>Photos</p>
            <div className="flex flex-wrap gap-3">
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border-2 border-blue-200 bg-slate-100">
                {primaryImage ? (
                  <>
                    <img src={primaryImage} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(null)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-600 hover:text-rose-600"
                      aria-label="Remove main photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700">
                    <ImagePlus className="h-6 w-6" />
                    Main photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleUpload(event.target.files, 'primary')}
                    />
                  </label>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-blue-700/90 py-0.5 text-center text-[10px] font-semibold text-white">
                  Main
                </span>
              </div>

              {extraImages.map((url) => (
                <div key={url} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setExtraImages((current) => current.filter((u) => u !== url))}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-600 hover:text-rose-600"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-700">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                {uploading ? 'Uploading…' : 'Add photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => handleUpload(event.target.files, 'extra')}
                />
              </label>
            </div>
          </div>

          {/* Basics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="product_name" className={labelClass}>
                Name
              </label>
              <input
                id="product_name"
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                className={inputClass}
                placeholder="Cable management tray"
              />
            </div>

            <div>
              <label htmlFor="product_category" className={labelClass}>
                Category
              </label>
              <input
                id="product_category"
                list="shop-category-options"
                value={form.category}
                onChange={(event) => set('category', event.target.value)}
                className={inputClass}
                placeholder="Home &amp; Organization"
              />
              <datalist id="shop-category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="product_slug" className={labelClass}>
                Web address (slug)
              </label>
              <input
                id="product_slug"
                value={form.slug}
                onChange={(event) => set('slug', event.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="cable-management-tray"
              />
            </div>

            <div>
              <label htmlFor="product_price" className={labelClass}>
                Price ($)
              </label>
              <input
                id="product_price"
                value={form.price}
                onChange={(event) => set('price', event.target.value)}
                className={inputClass}
                inputMode="decimal"
                placeholder="24.00"
              />
            </div>

            <div>
              <label htmlFor="product_compare" className={labelClass}>
                Compare at ($) <span className="font-normal text-slate-400">optional</span>
              </label>
              <input
                id="product_compare"
                value={form.compare_at_price}
                onChange={(event) => set('compare_at_price', event.target.value)}
                className={inputClass}
                inputMode="decimal"
                placeholder="30.00"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="product_short" className={labelClass}>
                Short description <span className="font-normal text-slate-400">shown on the card</span>
              </label>
              <input
                id="product_short"
                value={form.short_description}
                onChange={(event) => set('short_description', event.target.value)}
                className={inputClass}
                maxLength={160}
                placeholder="Keeps desk cables tidy — mounts with included screws."
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="product_description" className={labelClass}>
                Full description
              </label>
              <textarea
                id="product_description"
                rows={4}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                className={inputClass}
                placeholder="Dimensions, finish, what's included…"
              />
            </div>

            <FilamentSelect
              id="product_material"
              label="Material"
              value={form.material}
              options={materialOptions}
              onChange={(value) => set('material', value)}
              onAddOption={(value) => onAddFilamentOption('material', value)}
              addLabel="New filament type"
            />

            <FilamentSelect
              id="product_color"
              label="Color"
              value={form.color}
              options={colorOptions}
              onChange={(value) => set('color', value)}
              onAddOption={(value) => onAddFilamentOption('color', value)}
              addLabel="New color"
            />

            <div>
              <label htmlFor="product_lead" className={labelClass}>
                Lead time (days)
              </label>
              <input
                id="product_lead"
                type="number"
                min={0}
                value={form.lead_time_days}
                onChange={(event) => set('lead_time_days', event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="product_max" className={labelClass}>
                Max per order
              </label>
              <input
                id="product_max"
                type="number"
                min={1}
                value={form.max_per_order}
                onChange={(event) => set('max_per_order', event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Inventory + fulfillment */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Inventory &amp; fulfillment</p>

            <div className="mt-3 space-y-3">
              <Toggle
                label="Track inventory"
                hint="Off means made to order — it never shows as sold out."
                checked={form.track_inventory}
                onChange={(checked) => set('track_inventory', checked)}
              />

              {form.track_inventory && (
                <div className="max-w-[12rem]">
                  <label htmlFor="product_stock" className={labelClass}>
                    Units in stock
                  </label>
                  <input
                    id="product_stock"
                    type="number"
                    min={0}
                    value={form.stock_quantity}
                    onChange={(event) => set('stock_quantity', event.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <Toggle
                label="Can be shipped"
                hint="Turn off for pickup-only items."
                checked={form.requires_shipping}
                onChange={(checked) => set('requires_shipping', checked)}
              />
              <Toggle
                label="Local pickup available"
                checked={form.allow_local_pickup}
                onChange={(checked) => set('allow_local_pickup', checked)}
              />
            </div>
          </div>

          {/* Visibility */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Storefront</p>
            <div className="mt-3 space-y-3">
              <Toggle
                label="Show in the store"
                hint="Off keeps it as a draft only you can see."
                checked={form.is_active}
                onChange={(checked) => set('is_active', checked)}
              />
              <Toggle
                label="Staff pick"
                hint="Adds a badge to the product card."
                checked={form.is_featured}
                onChange={(checked) => set('is_featured', checked)}
              />
              <div className="max-w-[12rem]">
                <label htmlFor="product_order" className={labelClass}>
                  Sort order <span className="font-normal text-slate-400">lower shows first</span>
                </label>
                <input
                  id="product_order"
                  type="number"
                  value={form.display_order}
                  onChange={(event) => set('display_order', event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
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
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ADD_NEW = '__add_new__';

/**
 * Dropdown over a list the owner keeps in Store settings, with an inline
 * "Add new" so a fresh spool can be added without leaving a half-filled form.
 *
 * A value that is no longer in the list (a filament they used up and removed)
 * still appears as a choice, so editing an old product can't silently blank it.
 */
const FilamentSelect: React.FC<{
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddOption: (value: string) => Promise<void>;
  addLabel: string;
}> = ({ id, label, value, options, onChange, onAddOption, addLabel }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const knownValue = value && !options.includes(value) ? value : null;

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }

    setSaving(true);
    try {
      await onAddOption(trimmed);
      onChange(trimmed);
      setDraft('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void commit();
              } else if (event.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            placeholder={addLabel}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
          <button
            type="button"
            onClick={() => void commit()}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft('');
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(event) => {
            if (event.target.value === ADD_NEW) {
              setAdding(true);
              return;
            }
            onChange(event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          <option value="">Not specified</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {knownValue && <option value={knownValue}>{knownValue} (not in your list)</option>}
          <option value={ADD_NEW}>+ {addLabel}…</option>
        </select>
      )}
    </div>
  );
};

const Toggle: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <label className="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
    />
    <span>
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </span>
  </label>
);

export default ShopProductModal;
