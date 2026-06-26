import React, { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Search,
  RefreshCw,
  Mail,
  Ban,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import {
  listGiftCards,
  listRedemptionsForCard,
  redeemGiftCard,
  voidGiftCard,
  resendGiftCardEmail,
} from '../../services/giftCardService';
import { formatGiftCardDollars } from '../../constants/giftCards';
import type { GiftCard, GiftCardRedemption, GiftCardStatus } from '../../types/giftCard';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'partially_redeemed', label: 'Partially redeemed' },
  { value: 'redeemed', label: 'Fully redeemed' },
  { value: 'pending', label: 'Pending' },
  { value: 'voided', label: 'Voided' },
  { value: 'failed', label: 'Failed' },
];

const statusLabel = (s: GiftCardStatus) => {
  switch (s) {
    case 'active':
      return { text: 'Active', cls: 'bg-emerald-100 text-emerald-800' };
    case 'partially_redeemed':
      return { text: 'Partial', cls: 'bg-teal-100 text-teal-800' };
    case 'redeemed':
      return { text: 'Redeemed', cls: 'bg-slate-200 text-slate-700' };
    case 'pending':
      return { text: 'Pending', cls: 'bg-amber-100 text-amber-800' };
    case 'voided':
      return { text: 'Voided', cls: 'bg-red-100 text-red-800' };
    case 'failed':
      return { text: 'Failed', cls: 'bg-red-100 text-red-800' };
    default:
      return { text: s, cls: 'bg-slate-100 text-slate-700' };
  }
};

const GiftCardsPage: React.FC = () => {
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GiftCard | null>(null);

  const { showToast } = useToast();

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listGiftCards({ status, search });
      setCards(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const totals = useMemo(() => {
    const sold = cards.reduce(
      (acc, c) => (c.status === 'pending' || c.status === 'failed' ? acc : acc + c.initial_amount_cents),
      0,
    );
    const outstanding = cards.reduce(
      (acc, c) => (c.status === 'active' || c.status === 'partially_redeemed' ? acc + c.remaining_amount_cents : acc),
      0,
    );
    const redeemed = sold - outstanding;
    return { sold, outstanding, redeemed };
  }, [cards]);

  if (selected) {
    return (
      <GiftCardDetail
        card={selected}
        onBack={() => {
          setSelected(null);
          refresh();
        }}
        onChanged={(updated) => setSelected(updated)}
        onToast={(msg, type) => showToast({ message: msg, type })}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-emerald-600" /> Gift Cards
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage sold gift cards, redemptions, and balances.</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total sold" value={formatGiftCardDollars(totals.sold)} />
        <StatCard label="Outstanding balance" value={formatGiftCardDollars(totals.outstanding)} accent="teal" />
        <StatCard label="Redeemed to date" value={formatGiftCardDollars(totals.redeemed)} accent="slate" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') refresh(); }}
              placeholder="Search by code, name, or email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button onClick={refresh} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold">
            Search
          </button>
        </div>

        {error && (
          <div className="p-4 flex items-start gap-2 bg-red-50 border-b border-red-200 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : cards.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Gift className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p>No gift cards found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Code</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>Remaining</Th>
                  <Th>Purchaser</Th>
                  <Th>Recipient</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => {
                  const s = statusLabel(c.status);
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelected(c)}
                    >
                      <Td><span className="font-mono text-slate-900">{c.code}</span></Td>
                      <Td><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.text}</span></Td>
                      <Td>{formatGiftCardDollars(c.initial_amount_cents)}</Td>
                      <Td className="font-semibold text-slate-900">{formatGiftCardDollars(c.remaining_amount_cents)}</Td>
                      <Td>
                        <div className="text-slate-900">{c.purchaser_name}</div>
                        <div className="text-slate-500 text-xs">{c.purchaser_email}</div>
                      </Td>
                      <Td>
                        {c.delivery_type === 'recipient' ? (
                          <>
                            <div className="text-slate-900">{c.recipient_name || '—'}</div>
                            <div className="text-slate-500 text-xs">{c.recipient_email || ''}</div>
                          </>
                        ) : (
                          <span className="text-slate-400">Self</span>
                        )}
                      </Td>
                      <Td>{new Date(c.created_at).toLocaleDateString()}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="text-left font-medium px-4 py-2 whitespace-nowrap">{children}</th>
);

const Td: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <td title={title} className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>
);

const StatCard: React.FC<{ label: string; value: string; accent?: 'teal' | 'slate' | 'emerald' }> = ({ label, value, accent = 'emerald' }) => {
  const accentCls =
    accent === 'teal' ? 'text-teal-700' : accent === 'slate' ? 'text-slate-700' : 'text-emerald-700';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentCls}`}>{value}</p>
    </div>
  );
};

interface DetailProps {
  card: GiftCard;
  onBack: () => void;
  onChanged: (c: GiftCard) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const GiftCardDetail: React.FC<DetailProps> = ({ card, onBack, onChanged, onToast }) => {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<GiftCardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyJobId, setApplyJobId] = useState('');
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyNotes, setApplyNotes] = useState('');
  const [applying, setApplying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const loadRedemptions = async () => {
    setLoading(true);
    try {
      const rows = await listRedemptionsForCard(card.id);
      setRedemptions(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRedemptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const canRedeem = card.status === 'active' || card.status === 'partially_redeemed';

  const submitRedemption = async () => {
    const dollars = parseFloat(applyAmount);
    if (isNaN(dollars) || dollars <= 0) {
      onToast('Enter a valid dollar amount', 'error');
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents > card.remaining_amount_cents) {
      onToast('Amount exceeds remaining balance', 'error');
      return;
    }

    setApplying(true);
    try {
      const userName = (user?.user_metadata?.full_name as string | undefined) || user?.email || null;
      await redeemGiftCard({
        gift_card_id: card.id,
        amount_cents: cents,
        job_id: applyJobId || null,
        invoice_id: applyInvoiceId || null,
        redeemed_by_name: userName,
        redeemed_by_email: user?.email ?? null,
        notes: applyNotes || null,
      });
      onToast('Credit applied successfully', 'success');

      const updated: GiftCard = {
        ...card,
        remaining_amount_cents: card.remaining_amount_cents - cents,
        status: card.remaining_amount_cents - cents === 0 ? 'redeemed' : 'partially_redeemed',
      };
      onChanged(updated);
      setApplyAmount('');
      setApplyJobId('');
      setApplyInvoiceId('');
      setApplyNotes('');
      await loadRedemptions();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to apply credit', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleVoid = async () => {
    setVoiding(true);
    try {
      await voidGiftCard(card.id);
      onToast('Gift card voided', 'success');
      onChanged({ ...card, status: 'voided', remaining_amount_cents: 0 });
      setConfirmVoid(false);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to void card', 'error');
    } finally {
      setVoiding(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendGiftCardEmail(card.id);
      onToast('Gift card email resent', 'success');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to resend email', 'error');
    } finally {
      setResending(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(card.code);
    onToast('Code copied', 'success');
  };

  const s = statusLabel(card.status);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to gift cards
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-br from-teal-700 to-emerald-600 text-white p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Gift card</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-2xl sm:text-3xl font-bold tracking-wider">{card.code}</p>
                <button onClick={copyCode} className="p-1.5 rounded-md bg-white/15 hover:bg-white/25 transition">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.text}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Remaining</p>
              <p className="text-3xl font-bold">{formatGiftCardDollars(card.remaining_amount_cents)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide opacity-70">Initial value</p>
              <p className="text-xl font-semibold">{formatGiftCardDollars(card.initial_amount_cents)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 text-sm">
          <Info label="Purchaser" value={`${card.purchaser_name} <${card.purchaser_email}>`} />
          <Info
            label="Recipient"
            value={card.delivery_type === 'recipient' ? `${card.recipient_name || '—'} <${card.recipient_email || ''}>` : 'Self-delivery'}
          />
          <Info label="Delivery" value={card.delivery_type === 'recipient' ? 'Recipient' : 'Self'} />
          <Info label="Created" value={new Date(card.created_at).toLocaleString()} />
          {card.activated_at && <Info label="Activated" value={new Date(card.activated_at).toLocaleString()} />}
          {card.personal_message && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Personal message</p>
              <p className="italic text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">{card.personal_message}</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex flex-wrap gap-2">
          <button
            onClick={handleResend}
            disabled={resending || card.status === 'pending' || card.status === 'failed'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Resend email
          </button>
          {card.status !== 'voided' && (
            <button
              onClick={() => setConfirmVoid(true)}
              disabled={voiding}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 text-sm disabled:opacity-50"
            >
              <Ban className="w-4 h-4" /> Void card
            </button>
          )}
        </div>
      </div>

      {confirmVoid && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Void this gift card?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This sets the remaining balance to $0 and blocks further redemptions. This action is for issuing refunds or handling fraud — it does not refund the Stripe payment.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmVoid(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
              >
                {voiding && <Loader2 className="w-4 h-4 animate-spin" />} Void card
              </button>
            </div>
          </div>
        </div>
      )}

      {canRedeem && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Apply credit</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Amount (USD)" required>
              <input
                type="number"
                min="0"
                step="0.01"
                value={applyAmount}
                onChange={(e) => setApplyAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </Field>
            <Field label="Job ID (optional)">
              <input
                type="text"
                value={applyJobId}
                onChange={(e) => setApplyJobId(e.target.value)}
                placeholder="UUID"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono text-xs"
              />
            </Field>
            <Field label="Invoice ID (optional)">
              <input
                type="text"
                value={applyInvoiceId}
                onChange={(e) => setApplyInvoiceId(e.target.value)}
                placeholder="UUID"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono text-xs"
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea
              value={applyNotes}
              onChange={(e) => setApplyNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
              placeholder="Reason for redemption or reference…"
            />
          </Field>
          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-slate-500">
              Remaining balance: <strong>{formatGiftCardDollars(card.remaining_amount_cents)}</strong>
            </p>
            <button
              onClick={submitRedemption}
              disabled={applying || !applyAmount}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply credit
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Redemption history</h3>
        {loading ? (
          <div className="py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : redemptions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-600">
                <tr>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Applied to</Th>
                  <Th>Redeemed by</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <Td>{new Date(r.created_at).toLocaleString()}</Td>
                    <Td className="font-semibold">{formatGiftCardDollars(r.redeemed_amount_cents)}</Td>
                    <Td className="text-xs font-mono text-slate-500">
                      {r.invoice_id ? `Invoice ${r.invoice_id.slice(0, 8)}…` : r.job_id ? `Job ${r.job_id.slice(0, 8)}…` : '—'}
                    </Td>
                    <Td>{r.redeemed_by_name || r.redeemed_by_email || '—'}</Td>
                    <Td className="text-slate-600 max-w-xs truncate" title={r.notes || ''}>{r.notes || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
    <p className="mt-0.5 text-slate-800">{value}</p>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="mt-3 first:mt-0">
    <label className="block text-xs font-medium text-slate-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export default GiftCardsPage;
