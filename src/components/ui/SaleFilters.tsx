import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { SaleFilterRow, SaleScope } from '../../types/news';
import {
  FURNITURE_TYPE_LABELS,
  SALE_SCOPE_LABELS,
  countSales,
  hasSalesFilters,
  scopeCounts,
  storeOptions,
  typeOptions,
  type SalesFilters,
  type StoreOption,
} from '../../utils/news';

interface SaleFiltersProps {
  /** Live sales grouped by store, scope and type, with counts. */
  rows: SaleFilterRow[];
  filters: SalesFilters;
  /** Sales matching the filters, once the list has loaded. */
  resultCount: number | null;
  onChange: (next: SalesFilters) => void;
  /** The sort control, shown at the end of the filter row. */
  sort?: React.ReactNode;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

/** A filter control looks the same whether it is a button or a select; an applied one turns blue. */
const controlClass = (applied: boolean) =>
  `inline-flex h-11 items-center gap-2 rounded-lg border text-[15px] font-medium transition-colors ${focusRing} ${
    applied
      ? 'border-blue-700 bg-blue-50 text-blue-800'
      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
  }`;

const typeLabel = (type: string) =>
  FURNITURE_TYPE_LABELS[type as keyof typeof FURNITURE_TYPE_LABELS] ?? type.replace(/_/g, ' ');

/**
 * Store as a single drop-down. Busy weeks can bring a dozen stores, which as
 * chips crowded out everything else; in a menu they cost one button.
 */
const StoreMenu: React.FC<{
  stores: StoreOption[];
  total: number;
  selected: string | null;
  selectedName: string | null;
  onSelect: (slug: string | null) => void;
}> = ({ stores, total, selected, selectedName, onSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (slug: string | null) => {
    setOpen(false);
    trigger.current?.focus();
    if (slug !== selected) onSelect(slug);
  };

  const options: Array<{ slug: string | null; name: string; count: number }> = [
    { slug: null, name: 'All stores', count: total },
    ...stores,
  ];

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Store: ${selectedName ?? 'All stores'}`}
        onClick={() => setOpen((value) => !value)}
        className={`${controlClass(Boolean(selected) || open)} max-w-[16rem] pl-4 pr-3.5`}
      >
        <span className="truncate">{selectedName ?? 'Store'}</span>
        <ChevronDown
          className={`h-4 w-4 flex-none transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="group"
          aria-label="Store"
          className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
        >
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => {
              const isActive = option.slug === selected;
              return (
                <button
                  key={option.slug ?? 'all'}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => choose(option.slug)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition-colors ${focusRing} ${
                    isActive ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex-1">{option.name}</span>
                  <span className={`text-sm ${isActive ? 'text-blue-800' : 'text-gray-600'}`}>{option.count}</span>
                  <Check className={`h-4 w-4 flex-none ${isActive ? '' : 'invisible'}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Narrows the Sales tab by store, local or online, and furniture type, in one
 * row, with the result count, what is applied (as tags that undo themselves)
 * and the sort underneath. The
 * choices come from the sales that are live right now, so a store appears when
 * its first sale is approved and disappears when its last one ends, and each
 * count already accounts for the other filters (picking Online shows how many
 * of each store's sales are online).
 */
const SaleFilters: React.FC<SaleFiltersProps> = ({ rows, filters, resultCount, onChange, sort }) => {
  const stores = storeOptions(rows, filters);
  const scopes = scopeCounts(rows, filters);
  const types = typeOptions(rows, filters);
  const active = hasSalesFilters(filters);
  const typeId = useId();

  const set = (patch: Partial<SalesFilters>) => onChange({ ...filters, ...patch });

  const hasAnything = active || stores.length > 0 || scopes.local + scopes.online > 0 || types.length > 0;
  // Nothing tagged yet and nothing chosen: only the sort is worth showing.
  if (!hasAnything) {
    return sort ? <div className="mb-8 flex justify-end">{sort}</div> : null;
  }

  // The chosen store is always offered, even when it has no sales under the
  // other filters, so the visitor can see and undo it.
  const storeName = filters.store
    ? (rows.find((row) => row.store_slug === filters.store)?.store_name ?? filters.store)
    : null;
  const offeredStores =
    filters.store && !stores.some((store) => store.slug === filters.store)
      ? [...stores, { slug: filters.store, name: storeName ?? filters.store, count: 0 }]
      : stores;
  const totalForStores = countSales(rows, { scope: filters.scope, type: filters.type });

  const showWhere = scopes.local > 0 || scopes.online > 0 || Boolean(filters.scope);
  const whereOptions: Array<{ value: SaleScope | null; label: string }> = [
    { value: null, label: 'Anywhere' },
    { value: 'local', label: SALE_SCOPE_LABELS.local },
    { value: 'online', label: SALE_SCOPE_LABELS.online },
  ];

  const tags: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.store) tags.push({ key: 'store', label: storeName ?? filters.store, clear: () => set({ store: null }) });
  if (filters.scope) tags.push({ key: 'scope', label: SALE_SCOPE_LABELS[filters.scope], clear: () => set({ scope: null }) });
  if (filters.type) tags.push({ key: 'type', label: typeLabel(filters.type), clear: () => set({ type: null }) });

  return (
    <section aria-label="Filter sales" className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        {(stores.length > 0 || filters.store) && (
          <StoreMenu
            stores={offeredStores}
            total={totalForStores}
            selected={filters.store}
            selectedName={storeName}
            onSelect={(store) => set({ store })}
          />
        )}

        {showWhere && (
          <div role="group" aria-label="Where" className="flex h-11 items-center gap-0.5 rounded-lg bg-gray-100 p-1">
            {whereOptions.map((option) => {
              const isActive = filters.scope === option.value;
              const count = option.value ? scopes[option.value] : null;
              return (
                <button
                  key={option.value ?? 'any'}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => set({ scope: option.value })}
                  className={`h-9 whitespace-nowrap rounded-md px-3.5 text-[15px] transition-colors ${focusRing} ${
                    isActive ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'font-medium text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {option.label}
                  {count !== null && <span className="ml-1.5 text-sm font-normal text-gray-500">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {(types.length > 0 || filters.type) && (
          <div className="relative">
            <label htmlFor={typeId} className="sr-only">
              Furniture type
            </label>
            <select
              id={typeId}
              value={filters.type ?? ''}
              onChange={(event) => set({ type: (event.target.value || null) as SalesFilters['type'] })}
              className={`${controlClass(Boolean(filters.type))} cursor-pointer appearance-none pl-4 pr-10`}
            >
              <option value="">All furniture</option>
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
              {filters.type && !types.some((option) => option.value === filters.type) && (
                <option value={filters.type}>{typeLabel(filters.type)} (0)</option>
              )}
            </select>
            <ChevronDown
              className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
                filters.type ? 'text-blue-800' : 'text-gray-900'
              }`}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-2">
        <p className="mr-2 text-[15px] font-semibold text-gray-900" aria-live="polite">
          {resultCount === null ? '' : `${resultCount} ${resultCount === 1 ? 'sale' : 'sales'}`}
        </p>
        {tags.map((tag) => (
          <button
            key={tag.key}
            type="button"
            onClick={tag.clear}
            aria-label={`Remove filter: ${tag.label}`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-50 pl-3.5 pr-2.5 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100 ${focusRing}`}
          >
            {tag.label}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ))}
        {active && (
          <button
            type="button"
            onClick={() => onChange({ store: null, scope: null, type: null })}
            className={`h-9 rounded px-1.5 text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-gray-900 ${focusRing}`}
          >
            Clear all
          </button>
        )}
        {sort && <div className="ml-auto">{sort}</div>}
      </div>
    </section>
  );
};

export default SaleFilters;
