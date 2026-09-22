import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AddToWalletButton from '../../components/AddToWalletButton';
import {
  Ticket, Plus, Trash2, CheckCircle, AlertCircle, Share2, Copy, Link as LinkIcon,
  Power, Pencil, X, Calendar, TrendingUp, Megaphone, Sparkles, Facebook, Clock, Mail,
  Users, FlaskConical,
} from 'lucide-react';
import {
  getCoupons, getCouponRedemptions, createCoupon, updateCoupon, setCouponActive, deleteCoupon,
  draftCouponPromo, publishCouponPromo, sendCouponPromoReminder,
} from '../../services/couponService';
import {
  couponPromoState, couponState, datetimeLocalToTimestamp, defaultPromoPostAt,
  describeActiveDuration, describeDiscount, describePostDue, describeWindow,
  endDateToTimestamp, formatMoney, formatPostAt, formatUsedOn, isValidCouponCode, nextCouponToPost,
  normalizeCouponCode, startDateToTimestamp, timestampToDatetimeLocal,
  timestampToEndDate, timestampToStartDate, toDatetimeLocal,
  type CouponDiscountType, type CouponState,
} from '../../utils/coupon';
import type { Coupon, CouponInput, CouponRedemption } from '../../types/coupon';

interface FormState {
  id: string | null;
  code: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  promote: boolean;
  promo_post_on: string;
  promo_message: string;
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
  promote: false,
  promo_post_on: '',
  promo_message: '',
};

/**
 * How many names a card lists before it offers to show the rest. Enough to
 * see who has been using a code at a glance, few enough that a code used
 * fifty times does not bury every card under it.
 */
const USES_PREVIEW = 3;

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
  // Who used each code, keyed by code. Null means the lookup failed, which is
  // not the same as nobody having used anything — the cards say so differently.
  const [redemptions, setRedemptions] = useState<Record<string, CouponRedemption[]> | null>({});
  const [expandedUses, setExpandedUses] = useState<string[]>([]);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

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

      // Side by side: a coupon list with no names beside the counts is still
      // worth showing, so a failure here dims that one panel, not the page.
      const [codes, used] = await Promise.all([
        getCoupons(businessInfo.id),
        getCouponRedemptions(businessInfo.id).catch((error) => {
          console.error('Error loading coupon usage:', error);
          return null;
        }),
      ]);

      setCoupons(codes);
      setRedemptions(used);
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
      promote: coupon.promote,
      promo_post_on: timestampToDatetimeLocal(coupon.promo_post_at),
      promo_message: coupon.promo_message ?? '',
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

    // A promotion with no date never reaches the queue and never gets a
    // reminder, which is a quiet way to miss a campaign.
    if (form.promote && !form.promo_post_on) {
      return 'Pick a date to post this promotion, or untick "Promote this code".';
    }

    return null;
  };

  /**
   * Ticking Promote fills the post date in rather than leaving an empty box:
   * the morning of the code's first day, which is what it would be set to by
   * hand nine times out of ten.
   */
  const handlePromoteChange = (promote: boolean) => {
    setForm((current) => ({
      ...current,
      promote,
      promo_post_on: promote && !current.promo_post_on
        ? defaultPromoPostAt(current.starts_on)
        : current.promo_post_on,
    }));
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
      promote: form.promote,
      promo_post_at: form.promote ? datetimeLocalToTimestamp(form.promo_post_on) : null,
      promo_message: form.promo_message,
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

  /**
   * Draft the post with Claude. The form is open on this coupon when the
   * button is pressed there, so the result lands in the textarea too rather
   * than only in the database, where the admin would have to reopen to see it.
   */
  const handleDraft = async (coupon: Coupon) => {
    if (!businessId) return;
    setDraftingId(coupon.id);
    try {
      const result = await draftCouponPromo(coupon.id);
      setForm((current) => (current.id === coupon.id ? { ...current, promo_message: result.message } : current));
      setCoupons(await getCoupons(businessId));
      notify(
        result.drafted_by_claude ? 'success' : 'error',
        result.drafted_by_claude
          ? `Claude wrote a post for ${coupon.code}.`
          : `Claude was unavailable (${result.error ?? 'unknown error'}) — a plain version was written instead.`,
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to draft the post');
    } finally {
      setDraftingId(null);
    }
  };

  const handlePost = async (coupon: Coupon) => {
    if (!businessId) return;

    const message = form.id === coupon.id ? form.promo_message.trim() : '';
    const preview = message || coupon.promo_message?.trim();
    if (!confirm(`Post ${coupon.code} to your Facebook Page?${preview ? `\n\n${preview}` : ''}`)) return;

    setPostingId(coupon.id);
    try {
      const result = await publishCouponPromo(coupon.id, message || undefined);
      setCoupons(await getCoupons(businessId));
      notify(
        result.facebook.success ? 'success' : 'error',
        result.facebook.success
          ? `${coupon.code} posted to Facebook.`
          : `Facebook refused the post: ${result.facebook.error ?? 'unknown error'}`,
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to post to Facebook');
    } finally {
      setPostingId(null);
    }
  };

  /** Sends this coupon's reminder now, so the email can be checked before it matters. */
  const handleSendReminder = async (coupon: Coupon) => {
    if (!businessId) return;
    setRemindingId(coupon.id);
    try {
      const result = await sendCouponPromoReminder(coupon.id);
      setCoupons(await getCoupons(businessId));
      notify(
        result.sent > 0 ? 'success' : 'error',
        result.sent > 0
          ? `Reminder for ${coupon.code} sent to ${result.sentTo ?? 'your inbox'}.`
          : 'Nothing was sent — check the coupon still has a post date.',
      );
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to send the reminder');
    } finally {
      setRemindingId(null);
    }
  };

  /** Expands a card's usage list past the preview, or folds it back. */
  const toggleUses = (couponId: string) =>
    setExpandedUses((open) =>
      open.includes(couponId) ? open.filter((id) => id !== couponId) : [...open, couponId],
    );

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
  const nextUp = nextCouponToPost(coupons);
  const editing = form.id ? coupons.find((c) => c.id === form.id) ?? null : null;
  // An overdue promotion's own post date is in the past; flooring the picker at
  // "now" would mark the value it already holds invalid on open.
  const postAtMin = [toDatetimeLocal(new Date()), form.promo_post_on]
    .filter(Boolean)
    .sort()[0];
  const queuedCount = coupons.filter((c) => couponPromoState(c) === 'queued').length;

  /**
   * The form renders in one of two places, never both: at the top of the page
   * when creating, and in the edited coupon's own slot in the list when
   * editing. Editing used to jump the page to a form at the top, which on a
   * long list meant scrolling back to find the card you started from.
   */
  const renderForm = (className = '') => (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
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

        <div className="mt-6 pt-6 border-t border-slate-200">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 mb-1">
            <input
              type="checkbox"
              name="promote"
              checked={form.promote}
              onChange={(e) => handlePromoteChange(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="font-medium">Promote this code</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Puts it in the queue on this page, emails you a day before it is due, and gives it a one-click post
                to your Facebook Page. Leave this off for a code you are handing to one customer.
              </span>
            </span>
          </label>

          {form.promote && (
            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="md:max-w-xs">
                <label htmlFor="coupon-post-at" className="block text-sm font-medium text-slate-700 mb-2">
                  Post on
                </label>
                <input
                  id="coupon-post-at"
                  name="promo_post_on"
                  type="datetime-local"
                  value={form.promo_post_on}
                  min={postAtMin}
                  onChange={(e) => setForm({ ...form, promo_post_on: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  The queue is ordered by this, soonest first. Your reminder arrives 24 hours before.
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label htmlFor="coupon-post-message" className="block text-sm font-medium text-slate-700">
                    The post <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => handleDraft(editing)}
                      disabled={draftingId === editing.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {draftingId === editing.id ? 'Writing…' : 'Draft with Claude'}
                    </button>
                  )}
                </div>
                <textarea
                  id="coupon-post-message"
                  name="promo_message"
                  rows={6}
                  value={form.promo_message}
                  onChange={(e) => setForm({ ...form, promo_message: e.target.value })}
                  placeholder="Leave this empty and Claude writes it — when you press Draft, or automatically when your reminder goes out."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This is what goes on Facebook and what your reminder email quotes. Edit it however you like.
                  {!form.id && ' Save the coupon first and the Draft button appears here.'}
                </p>
              </div>
            </div>
          )}
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
  );

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


      {nextUp && (
        <div className="mb-6 bg-white rounded-xl border-2 border-emerald-500 overflow-hidden">
          <div className="bg-emerald-600 px-5 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-white text-sm font-semibold">
              <Megaphone className="w-4 h-4" />
              Next up to post
            </span>
            <span className="text-emerald-50 text-xs font-medium">
              {queuedCount === 1 ? '1 promotion queued' : `${queuedCount} promotions queued`}
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold font-mono tracking-wider text-slate-900 break-all">
                    {nextUp.code}
                  </h2>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {describeDiscount(nextUp)}
                  </span>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {describePostDue(nextUp.promo_post_at!)}
                  </span>
                </div>

                {nextUp.description && <p className="text-sm text-slate-600 mb-2">{nextUp.description}</p>}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Post {formatPostAt(nextUp.promo_post_at!)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Runs {describeActiveDuration(nextUp.starts_at, nextUp.ends_at)} · {describeWindow(nextUp.starts_at, nextUp.ends_at)}
                  </span>
                </div>

                {nextUp.promo_message ? (
                  <p className="mt-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 whitespace-pre-wrap">
                    {nextUp.promo_message}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-4 py-3">
                    No post written yet — <strong>Draft with Claude</strong> writes one, and the reminder email will do it
                    for you if you have not by then.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => handleDraft(nextUp)}
                  disabled={draftingId === nextUp.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {draftingId === nextUp.id ? 'Writing…' : nextUp.promo_message ? 'Rewrite' : 'Draft with Claude'}
                </button>
                <button
                  onClick={() => handlePost(nextUp)}
                  disabled={postingId === nextUp.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#1877F2] rounded-lg hover:bg-[#166fe0] transition-colors disabled:opacity-50"
                >
                  <Facebook className="w-4 h-4" />
                  {postingId === nextUp.id ? 'Posting…' : 'Post to Facebook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && !form.id && renderForm('mb-6')}

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
            // Editing swaps this card for the form, so it opens under the
            // pencil you just clicked rather than at the top of the page.
            if (showForm && form.id === coupon.id) {
              return <div key={coupon.id}>{renderForm()}</div>;
            }

            const state = couponState(coupon);
            const style = STATE_STYLES[state];
            const promo = couponPromoState(coupon);

            const used = redemptions?.[coupon.code] ?? [];
            const showAllUses = expandedUses.includes(coupon.id);
            const shownUses = showAllUses ? used : used.slice(0, USES_PREVIEW);
            // The counter counts submissions; the list can only show the ones
            // still on file. Renaming a code leaves its old uses behind under
            // the old spelling, and a deleted inquiry takes its name with it.
            const unaccounted = Math.max(0, coupon.times_used - used.length);

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
                      {promo === 'queued' && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                          <Megaphone className="w-3 h-3" />
                          {describePostDue(coupon.promo_post_at!)}
                        </span>
                      )}
                      {promo === 'posted' && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                          <Facebook className="w-3 h-3" />
                          Posted
                        </span>
                      )}
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

                    {used.length > 0 && (
                      <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                        <p className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <Users className="w-3.5 h-3.5" />
                          Who used it
                        </p>

                        <ul className="divide-y divide-slate-100 border-t border-slate-200">
                          {shownUses.map((use) => (
                            <li
                              key={use.inquiry_id}
                              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                  <span className="truncate">{use.client_name}</span>
                                  {use.is_test && (
                                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-[10px] font-semibold text-amber-800">
                                      <FlaskConical className="w-2.5 h-2.5" />
                                      TEST
                                    </span>
                                  )}
                                </p>
                                {use.client_email ? (
                                  <a
                                    href={`mailto:${use.client_email}`}
                                    className="text-sm text-emerald-700 hover:underline break-all"
                                  >
                                    {use.client_email}
                                  </a>
                                ) : (
                                  <span className="text-sm text-slate-400">No email given</span>
                                )}
                              </div>

                              <div className="ml-auto shrink-0 text-right">
                                <p className="text-xs text-slate-500">{formatUsedOn(use.used_at)}</p>
                                {use.discount_amount !== null && (
                                  <p className="text-xs font-semibold text-emerald-700">
                                    {formatMoney(use.discount_amount)} off
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>

                        {(used.length > USES_PREVIEW || unaccounted > 0) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50">
                            {used.length > USES_PREVIEW ? (
                              <button
                                onClick={() => toggleUses(coupon.id)}
                                aria-expanded={showAllUses}
                                className="text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                {showAllUses ? 'Show fewer' : `Show all ${used.length}`}
                              </button>
                            ) : (
                              <span />
                            )}
                            {unaccounted > 0 && (
                              <span className="text-xs text-slate-500">
                                {unaccounted} earlier {unaccounted === 1 ? 'use has' : 'uses have'} no request on file
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {redemptions && used.length === 0 && coupon.times_used > 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        {coupon.times_used === 1
                          ? 'No request on file for that use — it was deleted, or this code was renamed after it was used.'
                          : 'No request on file for those uses — they were deleted, or this code was renamed after they were used.'}
                      </p>
                    )}
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
                    {/* Always shown for admins, unlike the customer-facing
                        button, so the pass can be checked from any machine. */}
                    <AddToWalletButton code={coupon.code} variant="admin" />
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

                {promo !== 'none' && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-sm text-slate-600">
                        {promo === 'queued' && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 shrink-0" />
                            Post {formatPostAt(coupon.promo_post_at!)} · active {describeActiveDuration(coupon.starts_at, coupon.ends_at)}
                            {coupon.promo_reminder_sent_at && ' · reminder sent'}
                          </span>
                        )}
                        {promo === 'undated' && (
                          <span className="flex items-center gap-1.5 text-amber-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Promoted, but with no post date — it will not be queued or reminded about.
                          </span>
                        )}
                        {promo === 'posted' && (
                          <span className="flex items-center gap-1.5">
                            <Facebook className="w-4 h-4 shrink-0" />
                            Posted to Facebook {formatPostAt(coupon.facebook_posted_at!)}
                          </span>
                        )}
                      </div>

                      {promo !== 'posted' && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDraft(coupon)}
                            disabled={draftingId === coupon.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            title="Write the Facebook post with Claude"
                          >
                            <Sparkles className="w-4 h-4" />
                            {draftingId === coupon.id ? 'Writing…' : coupon.promo_message ? 'Rewrite' : 'Draft'}
                          </button>
                          {promo === 'queued' && (
                            <button
                              onClick={() => handleSendReminder(coupon)}
                              disabled={remindingId === coupon.id}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                              title="Send this reminder email now, to check it lands"
                            >
                              <Mail className="w-4 h-4" />
                              {remindingId === coupon.id ? 'Sending…' : 'Email me'}
                            </button>
                          )}
                          <button
                            onClick={() => handlePost(coupon)}
                            disabled={postingId === coupon.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-white bg-[#1877F2] rounded-lg hover:bg-[#166fe0] transition-colors disabled:opacity-50"
                          >
                            <Facebook className="w-4 h-4" />
                            {postingId === coupon.id ? 'Posting…' : 'Post to Facebook'}
                          </button>
                        </div>
                      )}
                    </div>

                    {coupon.facebook_post_error && (
                      <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Facebook refused the last post: {coupon.facebook_post_error}
                      </p>
                    )}
                  </div>
                )}

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
