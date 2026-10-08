import React from 'react';
import type { SaleFilterRow, SaleScope } from '../../types/news';
import {
  SALE_SCOPE_LABELS,
  countSales,
  hasSalesFilters,
  scopeCounts,
  storeOptions,
  typeOptions,
  type SalesFilters,
  type StoreOption,
} from '../../utils/news';

/** Stores shown as chips; the rest go in the "More stores" menu. */
const STORE_CHIPS_SHOWN = 8;

interface SaleFiltersProps {
  /** Live sales grouped by store, scope and type, with counts. */
  rows: SaleFilterRow[];
  filters: SalesFilters;
  /** Sales matching the filters, once the list has loaded. */
  resultCount: number | null;
  onChange: (next: SalesFilters) => void;
}

const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
    active
      ? 'bg-blue-700 text-white border-blue-700'
      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-700'
  }`;

const selectClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * Narrows the Sales tab by store, local or online, and furniture type. The
 * choices come from the sales that are live right now, so a store appears when
 * its first sale is approved and disappears when its last one ends, and each
 * count already accounts for the other filters (picking Online shows how many
 * of each store's sales are online).
 */
const SaleFilters: React.FC<SaleFiltersProps> = ({ rows, filters, resultCount, onChange }) => {
  const stores = storeOptions(rows, filters);
  const scopes = scopeCounts(rows, filters);
  const types = typeOptions(rows, filters);
  const active = hasSalesFilters(filters);

  // Nothing tagged yet and nothing chosen: there is nothing useful to offer.
  if (!active && stores.length === 0 && scopes.local + scopes.online === 0 && types.length === 0) {
    return null;
  }

  // The chosen store always has a chip, even when it is not among the busiest
  // or has no sales under the other filters, so the visitor can see and undo it.
  const chosen =
    filters.store && !stores.some((store) => store.slug === filters.store)
      ? [
          {
            slug: filters.store,
            name: rows.find((row) => row.store_slug === filters.store)?.store_name ?? filters.store,
            count: 0,
          } satisfies StoreOption,
        ]
      : [];
  const ranked = [...stores, ...chosen];
  const chips = ranked.slice(0, STORE_CHIPS_SHOWN);
  if (filters.store && !chips.some((store) => store.slug === filters.store)) {
    chips.push(ranked.find((store) => store.slug === filters.store) as StoreOption);
  }
  const overflow = ranked.filter((store) => !chips.includes(store));

  const set = (patch: Partial<SalesFilters>) => onChange({ ...filters, ...patch });
  const totalForStores = countSales(rows, { scope: filters.scope, type: filters.type });

  return (
    <section
      aria-label="Filter sales"
      className="mb-8 -mt-2 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      {(stores.length > 0 || filters.store) && (
        <div>
          <p id="sale-filter-store" className="mb-2 text-sm font-medium text-gray-700">
            Store
          </p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="sale-filter-store">
            <button
              type="button"
              aria-pressed={!filters.store}
              onClick={() => set({ store: null })}
              className={chipClass(!filters.store)}
            >
              All stores
              <span className="ml-1.5 opacity-75">{totalForStores}</span>
            </button>
            {chips.map((store) => {
              const isActive = filters.store === store.slug;
              return (
                <button
                  key={store.slug}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => set({ store: isActive ? null : store.slug })}
                  className={chipClass(isActive)}
                >
                  {store.name}
                  <span className="ml-1.5 opacity-75">{store.count}</span>
                </button>
              );
            })}
            {overflow.length > 0 && (
              <select
                aria-label="More stores"
                value=""
                onChange={(event) => event.target.value && set({ store: event.target.value })}
                className={selectClass}
              >
                <option value="">More stores ({overflow.length})</option>
                {overflow.map((store) => (
                  <option key={store.slug} value={store.slug}>
                    {store.name} ({store.count})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {(scopes.local > 0 || scopes.online > 0 || filters.scope) && (
          <div>
            <p id="sale-filter-where" className="mb-2 text-sm font-medium text-gray-700">
              Where
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sale-filter-where">
              <button
                type="button"
                aria-pressed={!filters.scope}
                onClick={() => set({ scope: null })}
                className={chipClass(!filters.scope)}
              >
                Anywhere
              </button>
              {(['local', 'online'] as SaleScope[]).map((scope) => {
                const isActive = filters.scope === scope;
                return (
                  <button
                    key={scope}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => set({ scope: isActive ? null : scope })}
                    className={chipClass(isActive)}
                  >
                    {SALE_SCOPE_LABELS[scope]}
                    <span className="ml-1.5 opacity-75">{scopes[scope]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(types.length > 0 || filters.type) && (
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            Furniture type
            <select
              value={filters.type ?? ''}
              onChange={(event) => set({ type: (event.target.value || null) as SalesFilters['type'] })}
              className={`${selectClass} font-normal`}
            >
              <option value="">All furniture</option>
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
              {filters.type && !types.some((option) => option.value === filters.type) && (
                <option value={filters.type}>{filters.type.replace(/_/g, ' ')} (0)</option>
              )}
            </select>
          </label>
        )}
      </div>

      {active && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-sm">
          <p className="text-gray-600" aria-live="polite">
            {resultCount === null
              ? ''
              : `${resultCount} ${resultCount === 1 ? 'sale matches' : 'sales match'} your filters`}
          </p>
          <button
            type="button"
            onClick={() => onChange({ store: null, scope: null, type: null })}
            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
};

export default SaleFilters;
