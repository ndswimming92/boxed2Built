import React, { useMemo, useState } from 'react';
import { Gift, Sparkles, ShieldCheck, Infinity as InfinityIcon, Mail, User, MessageSquareHeart } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/ui/Button';
import { GIFT_CARD_DENOMINATIONS, formatGiftCardDollars } from '../constants/giftCards';
import { createGiftCardCheckout } from '../services/giftCardService';
import { useToast } from '../contexts/ToastContext';
import type { GiftCardDeliveryType } from '../types/giftCard';
import { usePageMeta } from '../hooks/usePageMeta';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  delivery_type: GiftCardDeliveryType;
  recipient_name: string;
  recipient_email: string;
  personal_message: string;
};

const initialForm: FormState = {
  amount_cents: GIFT_CARD_DENOMINATIONS[1].amountCents,
  purchaser_name: '',
  purchaser_email: '',
  delivery_type: 'recipient',
  recipient_name: '',
  recipient_email: '',
  personal_message: '',
};

const GiftCardsPage: React.FC = () => {
  usePageMeta({
    title: 'Boxed2Built Gift Cards | Furniture Assembly Gift Cards in Spring Hill, TN',
    description:
      'Give the gift of a stress-free move-in day. Boxed2Built service credit for furniture assembly and TV mounting in Spring Hill, TN.',
    canonicalUrl: 'https://boxed2built.com/gift-cards',
    ogTitle: 'Boxed2Built Gift Cards | The Perfect Closing or Housewarming Gift',
    ogDescription: 'Give the gift of professional furniture assembly. Boxed2Built gift cards for stress-free move-in days in Spring Hill, TN.',
    twitterTitle: 'Boxed2Built Gift Cards | Furniture Assembly in Spring Hill, TN',
    twitterDescription: 'Give the gift of professional furniture assembly. Perfect for housewarmings and closing gifts.',
  });

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { showToast } = useToast();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const selectedAmount = useMemo(
    () => GIFT_CARD_DENOMINATIONS.find((d) => d.amountCents === form.amount_cents) || GIFT_CARD_DENOMINATIONS[0],
    [form.amount_cents],
  );

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.purchaser_name.trim()) next.purchaser_name = 'Please enter your name.';
    if (!EMAIL_RE.test(form.purchaser_email)) next.purchaser_email = 'Enter a valid email.';
    if (form.delivery_type === 'recipient') {
      if (!form.recipient_name.trim()) next.recipient_name = "Enter the recipient's name.";
      if (!EMAIL_RE.test(form.recipient_email)) next.recipient_email = "Enter the recipient's email.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { url } = await createGiftCardCheckout({
        amount_cents: form.amount_cents,
        purchaser_name: form.purchaser_name.trim(),
        purchaser_email: form.purchaser_email.trim(),
        delivery_type: form.delivery_type,
        recipient_name: form.delivery_type === 'recipient' ? form.recipient_name.trim() : undefined,
        recipient_email: form.delivery_type === 'recipient' ? form.recipient_email.trim() : undefined,
        personal_message: form.personal_message.trim() || undefined,
      });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start checkout.';
      showToast({ message: msg, type: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="pt-40 pb-20">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" /> Brand new
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
              Boxed2Built Gift Cards
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              The perfect housewarming, wedding, or thank-you gift. Credit toward furniture
              assembly, TV mounting, and any Boxed2Built service in Spring Hill, TN.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.1fr,1fr] gap-8">
            {/* Left: preview card + benefits */}
            <div className="space-y-6">
              <div className="relative rounded-3xl overflow-hidden shadow-xl">
                <div className="bg-gradient-to-br from-teal-700 via-emerald-600 to-teal-500 p-8 sm:p-10 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs uppercase tracking-widest">
                        <Gift className="w-3.5 h-3.5" /> Service credit
                      </div>
                      <p className="mt-6 text-sm uppercase tracking-widest opacity-80">Gift amount</p>
                      <p className="text-6xl sm:text-7xl font-extrabold mt-1">
                        {formatGiftCardDollars(selectedAmount.amountCents)}
                      </p>
                    </div>
                    <img
                      src="/white_boxed2built_logo.png"
                      alt="Boxed2Built"
                      className="h-12 opacity-90"
                    />
                  </div>
                  <div className="mt-10 flex items-end justify-between gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-75">For</p>
                      <p className="text-lg font-semibold truncate">
                        {form.delivery_type === 'recipient'
                          ? (form.recipient_name || 'Someone special')
                          : (form.purchaser_name || 'Yourself')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest opacity-75">From</p>
                      <p className="text-lg font-semibold truncate">{form.purchaser_name || 'You'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Benefit icon={InfinityIcon} title="Never expires" text="Balances roll over for future services." />
                <Benefit icon={ShieldCheck} title="Secure checkout" text="Payments processed by Stripe." />
                <Benefit icon={Gift} title="Easy to redeem" text="Apply the code when requesting a quote." />
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-2">How it works</h3>
                <ol className="space-y-2 text-sm text-slate-600 leading-relaxed list-decimal list-inside">
                  <li>Choose an amount and who it's for.</li>
                  <li>We email the code to you or your recipient.</li>
                  <li>Enter the code when requesting a quote — we apply it as credit on the final invoice.</li>
                </ol>
              </div>
            </div>

            {/* Right: form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900 mb-3">Choose an amount</legend>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Gift card amount">
                  {GIFT_CARD_DENOMINATIONS.map((d) => {
                    const selected = d.amountCents === form.amount_cents;
                    return (
                      <button
                        key={d.amountCents}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => set('amount_cents', d.amountCents)}
                        className={`relative rounded-xl border-2 px-4 py-5 text-left transition-all ${
                          selected
                            ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-2xl font-bold text-slate-900">{d.label}</span>
                        <span className="block text-xs text-slate-500 mt-1">Service credit</span>
                        {selected && (
                          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <InputField
                  id="purchaser_name"
                  label="Your name"
                  icon={User}
                  value={form.purchaser_name}
                  onChange={(v) => set('purchaser_name', v)}
                  error={errors.purchaser_name}
                  autoComplete="name"
                  required
                />
                <InputField
                  id="purchaser_email"
                  label="Your email"
                  icon={Mail}
                  type="email"
                  value={form.purchaser_email}
                  onChange={(v) => set('purchaser_email', v)}
                  error={errors.purchaser_email}
                  autoComplete="email"
                  required
                />
              </div>

              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-slate-900 mb-3">Who's this for?</legend>
                <div className="grid grid-cols-2 gap-3">
                  <ToggleOption
                    selected={form.delivery_type === 'recipient'}
                    onClick={() => set('delivery_type', 'recipient')}
                    label="For someone else"
                    sub="We'll email them the code"
                  />
                  <ToggleOption
                    selected={form.delivery_type === 'self'}
                    onClick={() => set('delivery_type', 'self')}
                    label="For me"
                    sub="Email the code to my inbox"
                  />
                </div>
              </fieldset>

              {form.delivery_type === 'recipient' && (
                <div className="mt-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      id="recipient_name"
                      label="Recipient name"
                      icon={User}
                      value={form.recipient_name}
                      onChange={(v) => set('recipient_name', v)}
                      error={errors.recipient_name}
                      autoComplete="off"
                      required
                    />
                    <InputField
                      id="recipient_email"
                      label="Recipient email"
                      icon={Mail}
                      type="email"
                      value={form.recipient_email}
                      onChange={(v) => set('recipient_email', v)}
                      error={errors.recipient_email}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="personal_message" className="block text-sm font-medium text-slate-700 mb-1">
                      Personal message <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <MessageSquareHeart className="absolute top-3 left-3 w-4 h-4 text-slate-400" />
                      <textarea
                        id="personal_message"
                        rows={3}
                        maxLength={500}
                        value={form.personal_message}
                        onChange={(e) => set('personal_message', e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none"
                        placeholder="Add a note they'll see in the email…"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-right">{form.personal_message.length}/500</p>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  loading={submitting}
                  disabled={submitting}
                >
                  Continue to Checkout — {formatGiftCardDollars(selectedAmount.amountCents)}
                </Button>
                <p className="mt-3 text-xs text-slate-500 text-center">
                  You'll complete payment securely on Stripe. Your credit never expires and is redeemable
                  only for Boxed2Built services.
                </p>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

function Benefit({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <Icon className="w-5 h-5 text-emerald-700" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function ToggleOption({
  selected,
  onClick,
  label,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
        selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>
    </button>
  );
}

function InputField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  error,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
  type?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-slate-400" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm transition-colors ${
            error
              ? 'border-red-400 focus:ring-2 focus:ring-red-100'
              : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
          }`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default GiftCardsPage;
