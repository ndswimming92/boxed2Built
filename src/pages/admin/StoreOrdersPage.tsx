import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney, listOrderItems, listOrders, updateOrder } from '../../services/shopService';
import type { ShopOrder, ShopOrderItem, ShopOrderStatus } from '../../types/shop';

const STATUS_FILTERS: Array<{ value: ShopOrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All orders' },
  { value: 'paid', label: 'Paid — needs printing' },
  { value: 'in_production', label: 'In production' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

const STATUS_STYLES: Record<ShopOrderStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting payment', className: 'bg-slate-100 text-slate-600' },
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' },
  in_production: { label: 'In production', className: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Completed', className: 'bg-slate-800 text-white' },
  canceled: { label: 'Canceled', className: 'bg-slate-200 text-slate-700' },
  refunded: { label: 'Refunded', className: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Failed', className: 'bg-rose-100 text-rose-800' },
};

/** Statuses an admin can move an order to, in the order they normally happen. */
const NEXT_STATUSES: ShopOrderStatus[] = [
  'paid',
  'in_production',
  'shipped',
  'completed',
  'canceled',
  'refunded',
];

const StoreOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ShopOrderItem[]>>({});
  const [status, setStatus] = useState<ShopOrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listOrders({ status, search });
      setOrders(list);
      setItemsByOrder(await listOrderItems(list.map((order) => order.id)));
    } catch (loadError) {
      console.error('Failed to load store orders:', loadError);
      setError('Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const paidStatuses: ShopOrderStatus[] = ['paid', 'in_production', 'shipped', 'completed'];
    const revenue = orders
      .filter((order) => paidStatuses.includes(order.status))
      .reduce((sum, order) => sum + order.total_cents, 0);

    return {
      toPrint: orders.filter((order) => order.status === 'paid').length,
      inProduction: orders.filter((order) => order.status === 'in_production').length,
      revenue,
    };
  }, [orders]);

  const applyChange = async (
    order: ShopOrder,
    patch: Partial<Pick<ShopOrder, 'status' | 'admin_notes' | 'tracking_carrier' | 'tracking_number'>>,
  ) => {
    setBusyId(order.id);
    try {
      const fulfilledNow =
        patch.status === 'shipped' || patch.status === 'completed'
          ? { fulfilled_at: order.fulfilled_at ?? new Date().toISOString() }
          : {};
      const updated = await updateOrder(order.id, { ...patch, ...fulfilledNow });
      setOrders((current) => current.map((item) => (item.id === order.id ? updated : item)));
      showToast({ message: 'Order updated', type: 'success' });
    } catch (updateError) {
      console.error('Failed to update order:', updateError);
      showToast({ message: 'Could not update that order.', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Store orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Print shop orders paid through Stripe. Update the status as you print and ship.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ready to print" value={String(stats.toPrint)} accent="emerald" />
        <StatCard label="In production" value={String(stats.inProduction)} accent="blue" />
        <StatCard label="Revenue (filtered)" value={formatMoney(stats.revenue)} accent="slate" />
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
              placeholder="Order number, name, or email"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ShopOrderStatus | 'all')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <ShoppingBag className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No orders here yet</p>
            <p className="mt-1 text-sm">Orders show up the moment Stripe confirms payment.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((order) => {
              const expanded = expandedId === order.id;
              const items = itemsByOrder[order.id] ?? [];
              const style = STATUS_STYLES[order.status];

              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-slate-50"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {order.order_number}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                        >
                          {style.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          {order.fulfillment_method === 'pickup' ? (
                            <>
                              <Package className="h-3 w-3" /> Pickup
                            </>
                          ) : (
                            <>
                              <Truck className="h-3 w-3" /> Ship
                            </>
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {order.customer_name || 'Unnamed'} · {order.customer_email}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatMoney(order.total_cents)}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <OrderDetail
                      order={order}
                      items={items}
                      busy={busyId === order.id}
                      onChange={(patch) => applyChange(order, patch)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

interface OrderDetailProps {
  order: ShopOrder;
  items: ShopOrderItem[];
  busy: boolean;
  onChange: (
    patch: Partial<Pick<ShopOrder, 'status' | 'admin_notes' | 'tracking_carrier' | 'tracking_number'>>,
  ) => void;
}

const OrderDetail: React.FC<OrderDetailProps> = ({ order, items, busy, onChange }) => {
  const [carrier, setCarrier] = useState(order.tracking_carrier ?? '');
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [notes, setNotes] = useState(order.admin_notes ?? '');

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600';

  return (
    <div className="grid gap-6 border-t border-slate-100 bg-slate-50 px-6 py-5 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 px-3 py-2 text-sm">
              <span className="text-slate-700">
                {item.product_name}
                <span className="text-slate-400"> × {item.quantity}</span>
              </span>
              <span className="font-medium text-slate-900">
                {formatMoney(item.line_total_cents)}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-4 px-3 py-2 text-sm text-slate-600">
            <span>Shipping</span>
            <span>{formatMoney(order.shipping_cents)}</span>
          </li>
          {order.tax_cents > 0 && (
            <li className="flex justify-between gap-4 px-3 py-2 text-sm text-slate-600">
              <span>Tax</span>
              <span>{formatMoney(order.tax_cents)}</span>
            </li>
          )}
          <li className="flex justify-between gap-4 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
            <span>Total</span>
            <span>{formatMoney(order.total_cents)}</span>
          </li>
        </ul>

        {order.customer_note && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-semibold">Customer note:</span> {order.customer_note}
          </div>
        )}

        <div className="mt-4 space-y-1 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            <a href={`mailto:${order.customer_email}`} className="text-blue-700 hover:underline">
              {order.customer_email}
            </a>
          </p>
          {order.customer_phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <a href={`tel:${order.customer_phone}`} className="text-blue-700 hover:underline">
                {order.customer_phone}
              </a>
            </p>
          )}
          {order.fulfillment_method === 'shipping' && order.shipping_line1 && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span>
                {order.shipping_line1}
                {order.shipping_line2 ? `, ${order.shipping_line2}` : ''}
                <br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-900">Move to</p>
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUSES.filter((next) => next !== order.status).map((next) => (
              <button
                key={next}
                type="button"
                disabled={busy}
                onClick={() => onChange({ status: next })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
              >
                {STATUS_STYLES[next].label}
              </button>
            ))}
          </div>
        </div>

        {order.fulfillment_method === 'shipping' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`carrier-${order.id}`}
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Carrier
              </label>
              <input
                id={`carrier-${order.id}`}
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                className={inputClass}
                placeholder="USPS"
              />
            </div>
            <div>
              <label
                htmlFor={`tracking-${order.id}`}
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Tracking number
              </label>
              <input
                id={`tracking-${order.id}`}
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor={`notes-${order.id}`}
            className="mb-1 block text-xs font-semibold text-slate-600"
          >
            Internal notes
          </label>
          <textarea
            id={`notes-${order.id}`}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onChange({
              admin_notes: notes.trim() || null,
              tracking_carrier: carrier.trim() || null,
              tracking_number: tracking.trim() || null,
            } as Partial<ShopOrder>)
          }
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save details
        </button>

        {order.stripe_checkout_session_id && (
          <p className="text-xs text-slate-400">
            Stripe session {order.stripe_checkout_session_id}
          </p>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent: 'emerald' | 'blue' | 'slate' }> = ({
  label,
  value,
  accent,
}) => {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'blue'
        ? 'text-blue-700'
        : 'text-slate-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
};

export default StoreOrdersPage;
