import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Ticket, Plus, Trash2, CheckCircle, AlertCircle, Share2, Copy, Link as LinkIcon,
  Power, Pencil, X, Calendar, TrendingUp,
} from 'lucide-react';
import {
  getCoupons, createCoupon, updateCoupon, setCouponActive, deleteCoupon,
} from '../../services/couponService';
import {
  couponState, describeDiscount, describeWindow, endDateToTimestamp,
  isValidCouponCode, normalizeCouponCode, startDateToTimestamp, timestampToEndDate,
  timestampToStartDate, type CouponDiscountType, type CouponState,
} from '../../utils/coupon';
import type { Coupon, CouponInput } from '../../types/coupon';

interface FormState {
  id: string | null;
  code: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  code: '',
  description: '',
  discount_type: 'fixed',
  discount_value: '',
  starts_on: '',
  ends_on: '',
  is_active: true,
};

const STATE_STYLES: Record<CouponState, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  expired: { label: 'Expired', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  off: { label: 'Off', className: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id, organization_id')
        .eq('is_active', true)
        .maybeSingle();

      if (!businessInfo) {
        setLoading(false);
        return;
      }

      setBusinessId(businessInfo.id);
      setOrganizationId(businessInfo.organization_id ?? null);
      setCoupons(await getCoupons(businessInfo.id));
    } catch (error) {
      console.error('Error loading coupons:', error);
      notify('error', 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (coupon: Coupon) => {
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description ?? '',
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      starts_on: timestampToStartDate(coupon.starts_at),
      ends_on: timestampToEndDate(coupon.ends_at),
      is_active: coupon.is_active,
    });
    setShowForm(true);
  };

  /** Everything the database CHECKs, checked here first so the error is readable. */
  const validate = (): string | null => {
    const code = normalizeCouponCode(form.code);
    if (!isValidCouponCode(code)) {
      return 'Codes are 3–30 characters: letters, numbers and dashes, starting with a letter or number.';
    }

    const value = Number(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) return 'Enter a discount greater than zero.';
    if (form.discount_type === 'percentage' && value > 100) return 'A percentage cannot be over 100%.';

    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) {
      return 'The end date is before the start date.';
    }

    return null;
  };

  const handleSave = async () => {
    if (!businessId) return;

    const problem = validate();
    if (problem) {
      notify('error', problem);
      return;
    }

    const input: CouponInput = {
      code: normalizeCouponCode(form.code),
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      starts_at: startDateToTimestamp(form.starts_on),
      ends_at: endDateToTimestamp(form.ends_on),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (form.id) {
        await updateCoupon(form.id, input);
        notify('success', `${input.code} updated.`);
      } else {
        await createCoupon(businessId, organizationId, input);
        notify('success', `${input.code} is ready to share.`);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setCoupons(await getCoupons(businessId));
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    if (!businessId) return;
    try {
      await setCouponActive(coupon.id, !coupon.is_active);
      setCoupons(await getCoupons(businessId));
      notify('success', `${coupon.code} turned ${coupon.is_active ? 'off' : 'on'}.`);
    } catch (error) {
      console.error('Error toggling coupon:', error);
      notify('error', 'Failed to update coupon');
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!businessId) return;
    const used = coupon.times_used > 0
      ? ` It has been used ${coupon.times_used} time${coupon.times_used === 1 ? '' : 's'}; those quotes keep their discount.`
      : '';
    if (!confirm(`Delete ${coupon.code}? Customers entering it will stop getting the discount.${used}`)) return;

    try {
      await deleteCoupon(coupon.id, coupon.code);
      setCoupons(await getCoupons(businessId));
      notify('success', `${coupon.code} deleted.`);
    } catch (error) {
      console.error('Error deleting coupon:', error);
      notify('error', 'Failed to delete coupon');
    }
  };

  const shareLink = (code: string) =>
    `${typeof window === 'undefined' ? 'https://www.boxed2built.com' : window.location.origin}/contact?coupon=${encodeURIComponent(code)}`;

  const copy = async (id: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
      notify('success', `${what} copied.`);
    } catch {
      notify('error', 'Could not copy to clipboard');
    }
  };

  /** The OS share sheet where there is one; a copied link everywhere else. */
  const handleShare = async (coupon: Coupon) => {
    const url = shareLink(coupon.code);
    const text = `Use code ${coupon.code} for ${describeDiscount(coupon)} your Boxed2Built quote.`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${coupon.code} — ${describeDiscount(coupon)}`, text, url });
        return;
      } catch (error) {
        // Cancelling the sheet throws too; fall through to copying either way.
        if ((error as Error)?.name === 'AbortError') return;
      }
    }

    await copy(`${coupon.id}-share`, `${text} ${url}`, 'Share message');
  };

  const activeCount = coupons.filter((c) => couponState(c) === 'active').length;
  const totalUses = coupons.reduce((sum, c) => sum + c.times_used, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Coupon Codes</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Discounts customers can enter on your quote form. {activeCount} live now · {totalUses} total uses
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Coupon
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {form.id ? `Edit ${form.code}` : 'New coupon'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close coupon form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="coupon-code" className="block text-sm font-medium text-slate-700 mb-2">Code</label>
              <input
                id="coupon-code"
                name="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: normalizeCouponCode(e.target.value) })}
                placeholder="WELCOME25"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">This is what the customer types on the form.</p>
            </div>

            <div>
              <label htmlFor="coupon-description" className="block text-sm font-medium text-slate-700 mb-2">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="coupon-description"
                name="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="New customer welcome offer"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="coupon-type" className="block text-sm font-medium text-slate-700 mb-2">Discount</label>
              <div className="flex gap-2">
                <select
                  id="coupon-type"
                  name="discount_type"
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as CouponDiscountType })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="fixed">$ off</option>
                  <option value="percentage">% off</option>
                </select>
                <input
                  id="coupon-value"
                  name="discount_value"
                  type="number"
                  min="0"
                  step={form.discount_type === 'percentage' ? '1' : '0.01'}
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'percentage' ? '10' : '25'}
                  className="flex-1 min-w-0 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Accept this code on the form
              </label>
            </div>

            <div>
              <label htmlFor="coupon-starts" className="block text-sm font-medium text-slate-700 mb-2">
                First day <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="coupon-starts"
                name="starts_on"
                type="date"
                value={form.starts_on}
                onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to start right away.</p>
            </div>

            <div>
              <label htmlFor="coupon-ends" className="block text-sm font-medium text-slate-700 mb-2">
                Last day <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="coupon-ends"
                name="ends_on"
                type="date"
                value={form.ends_on}
                onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Works through the end of this day. Empty never expires.</p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create coupon'}
            </button>
          </div>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-2 text-lg font-medium">No coupon codes yet</p>
          <p className="text-sm text-slate-500">
            Create one and customers can enter it in the referral or coupon box on your quote form.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {coupons.map((coupon) => {
            const state = couponState(coupon);
            const style = STATE_STYLES[state];

            return (
              <div key={coupon.id} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold font-mono tracking-wider text-slate-900 break-all">
                        {coupon.code}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${style.className}`}>
                        {style.label}
                      </span>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {describeDiscount(coupon)}
                      </span>
                    </div>

                    {coupon.description && (
                      <p className="text-sm text-slate-600 mb-2">{coupon.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {describeWindow(coupon.starts_at, coupon.ends_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Used {coupon.times_used} {coupon.times_used === 1 ? 'time' : 'times'}
                        {coupon.last_used_at
                          ? ` · last ${new Date(coupon.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => copy(coupon.id, coupon.code, 'Code')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      aria-label={`Copy code ${coupon.code}`}
                    >
                      <Copy className="w-4 h-4" />
                      {copiedId === coupon.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => copy(`${coupon.id}-link`, shareLink(coupon.code), 'Link')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      aria-label={`Copy prefilled link for ${coupon.code}`}
                      title="A link to your quote form with this code already filled in"
                    >
                      <LinkIcon className="w-4 h-4" />
                      {copiedId === `${coupon.id}-link` ? 'Copied' : 'Link'}
                    </button>
                    <button
                      onClick={() => handleShare(coupon)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      aria-label={`Share ${coupon.code}`}
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    <button
                      onClick={() => handleToggle(coupon)}
                      className={`p-2 rounded-lg transition-colors ${
                        coupon.is_active
                          ? 'text-emerald-700 hover:bg-emerald-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      aria-label={`Turn ${coupon.code} ${coupon.is_active ? 'off' : 'on'}`}
                      title={coupon.is_active ? 'Turn off' : 'Turn on'}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openEdit(coupon)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      aria-label={`Edit ${coupon.code}`}
                      title="Edit"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label={`Delete ${coupon.code}`}
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {state === 'off' && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Turned off — the form will not accept this code until you turn it back on.
                  </p>
                )}
                {state === 'scheduled' && coupon.starts_at && (
                  <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    Starts {new Date(coupon.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                    Customers entering it before then are told it is not a coupon code.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
