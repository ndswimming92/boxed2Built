import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ShopProductModal from '../../components/admin/ShopProductModal';
import ShopSettingsModal from '../../components/admin/ShopSettingsModal';
import { useToast } from '../../contexts/ToastContext';
import {
  addFilamentOption,
  deleteProduct,
  formatMoney,
  getShopSettings,
  listAllProducts,
  updateProduct,
} from '../../services/shopService';
import type { ShopProduct, ShopSettings } from '../../types/shop';

const StoreProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: business } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (business?.id) setBusinessId(business.id);

      const [productList, shopSettings] = await Promise.all([listAllProducts(), getShopSettings()]);
      setProducts(productList);
      setSettings(shopSettings);
    } catch (loadError) {
      console.error('Failed to load store products:', loadError);
      setError('Could not load the store catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.category, product.short_description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [products, search]);

  const stats = useMemo(() => {
    const live = products.filter((product) => product.is_active);
    const soldOut = live.filter(
      (product) => product.track_inventory && product.stock_quantity === 0,
    );
    return {
      live: live.length,
      drafts: products.length - live.length,
      soldOut: soldOut.length,
    };
  }, [products]);

  const toggleActive = async (product: ShopProduct) => {
    setBusyId(product.id);
    try {
      const updated = await updateProduct(product.id, { is_active: !product.is_active });
      setProducts((current) => current.map((item) => (item.id === product.id ? updated : item)));
      showToast({
        message: updated.is_active ? `${updated.name} is live` : `${updated.name} hidden`,
        type: 'success',
      });
    } catch (toggleError) {
      console.error('Failed to toggle product:', toggleError);
      showToast({ message: 'Could not update that product.', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddFilamentOption = async (kind: 'material' | 'color', value: string) => {
    if (!businessId) return;
    try {
      const current =
        (kind === 'material' ? settings?.material_options : settings?.color_options) ?? [];
      const saved = await addFilamentOption(businessId, kind, value, current);
      if (saved) setSettings(saved);
    } catch (optionError) {
      console.error('Failed to save filament option:', optionError);
      showToast({ message: 'Could not save that to your filament list.', type: 'error' });
    }
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!window.confirm(`Delete "${product.name}"? Past orders keep their own copy of the item.`)) {
      return;
    }

    setBusyId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      showToast({ message: `${product.name} deleted`, type: 'success' });
    } catch (deleteError) {
      console.error('Failed to delete product:', deleteError);
      showToast({ message: 'Could not delete that product.', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store products</h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything here feeds the public store at{' '}
            <a
              href="/store"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
            >
              /store <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            disabled={!businessId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Settings className="h-4 w-4" />
            Store settings
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={!businessId}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Live in the store" value={String(stats.live)} accent="emerald" />
        <StatCard label="Hidden drafts" value={String(stats.drafts)} accent="slate" />
        <StatCard label="Sold out" value={String(stats.soldOut)} accent="amber" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Boxes className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">
              {products.length === 0 ? 'No products yet' : 'Nothing matches that search'}
            </p>
            {products.length === 0 && (
              <p className="mt-1 text-sm">
                Add your first print and it shows up on the store page right away.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="max-w-xs truncate text-xs text-slate-500">
                            {product.short_description || product.slug}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-slate-600">{product.category}</Td>
                    <Td className="font-semibold text-slate-900">
                      {formatMoney(product.price_cents)}
                    </Td>
                    <Td className="text-slate-600">
                      {product.track_inventory ? (
                        <span
                          className={product.stock_quantity === 0 ? 'font-semibold text-rose-600' : ''}
                        >
                          {product.stock_quantity}
                        </span>
                      ) : (
                        <span className="text-slate-400">Made to order</span>
                      )}
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {product.is_active ? 'Live' : 'Hidden'}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <IconButton
                          label={product.is_active ? 'Hide from store' : 'Show in store'}
                          onClick={() => toggleActive(product)}
                          disabled={busyId === product.id}
                        >
                          {product.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </IconButton>
                        <IconButton label="Edit product" onClick={() => setEditing(product)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete product"
                          onClick={() => handleDelete(product)}
                          disabled={busyId === product.id}
                          danger
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && businessId && (
        <ShopProductModal
          businessId={businessId}
          product={editing ?? undefined}
          categories={categories}
          materialOptions={settings?.material_options ?? []}
          colorOptions={settings?.color_options ?? []}
          onAddFilamentOption={handleAddFilamentOption}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            showToast({ message: 'Product saved', type: 'success' });
            load();
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {showSettings && businessId && (
        <ShopSettingsModal
          businessId={businessId}
          settings={settings}
          onSaved={(saved) => {
            setSettings(saved);
            setShowSettings(false);
            showToast({ message: 'Store settings saved', type: 'success' });
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="whitespace-nowrap px-4 py-2 text-left font-medium">{children}</th>
);

const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

const StatCard: React.FC<{ label: string; value: string; accent: 'emerald' | 'slate' | 'amber' }> = ({
  label,
  value,
  accent,
}) => {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'amber'
        ? 'text-amber-600'
        : 'text-slate-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
};

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${
      danger
        ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    {children}
  </button>
);

export default StoreProductsPage;
