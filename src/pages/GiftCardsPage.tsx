import { Head } from 'vite-react-ssg';
import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Circle,
  CreditCard,
  Gift,
  Infinity as InfinityIcon,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import StarRating from '../components/ui/StarRating';
import FormProgressRail from '../components/ui/FormProgressRail';
import {
  GIFT_CARD_COVERAGE,
  GIFT_CARD_DENOMINATIONS,
  GIFT_CARD_MIN_CENTS,
  GIFT_CARD_MAX_CENTS,
  formatGiftCardDollars,
  parseCustomAmountToCents,
} from '../constants/giftCards';
import { createGiftCardCheckout } from '../services/giftCardService';
import { useToast } from '../contexts/ToastContext';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { calculateRatingStats } from '../utils/ratingCalculations';
import { formatPhoneForDisplay } from '../services/communicationService';
import type { GiftCardDeliveryType } from '../types/giftCard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared with the homepage quote form so the two read as one system.
const cardCls = 'bg-white border border-[#ECE3D2] rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(14,39,72,0.05)]';
const labelCls = 'block text-[13px] font-semibold text-[#0E2748] mb-1.5';
const stepBadgeCls = 'w-[26px] h-[26px] shrink-0 rounded-full bg-[#0E2748] text-[#FBF8F1] text-[13px] font-bold inline-flex items-center justify-center';
const requiredMark = <span className="text-[#B45309] font-bold">*</span>;

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

/** Short line under each amount tile, derived from the coverage list. */
function coverageHint(dollars: number): string {
  const covered = GIFT_CARD_COVERAGE.filter((c) => dollars >= c.fromDollars);
  if (covered.length === 0) return 'Goes toward any service';
  if (covered.length === 1) return `Covers ${covered[0].label.toLowerCase()}`;
  return `Covers ${covered.length} service types`;
}

const GiftCardsPage: React.FC = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { showToast } = useToast();
  const customInputRef = useRef<HTMLInputElement>(null);

  const { data: businessData } = useBusinessDataWithFallback();
  const ratingStats = calculateRatingStats(businessData?.reviews || []);
  const phoneRaw = businessData?.info?.phone || '+16154034538';
  const phoneDisplay = formatPhoneForDisplay(phoneRaw.replace(/^\+1/, ''));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const selectPreset = (amountCents: number) => {
    setCustomMode(false);
    setCustomInput('');
    set('amount_cents', amountCents);
  };

  const chooseCustom = () => {
    setCustomMode(true);
    const cents = parseCustomAmountToCents(customInput);
    set('amount_cents', cents ?? 0);
    // Focus the field on the next paint so it's ready to type into.
    requestAnimationFrame(() => customInputRef.current?.focus());
  };

  const onCustomInputChange = (raw: string) => {
    // Allow digits and a single decimal point while typing.
    const cleaned = raw.replace(/[^\d.]/g, '');
    setCustomInput(cleaned);
    const cents = parseCustomAmountToCents(cleaned);
    set('amount_cents', cents ?? 0);
  };

  const amountInRange =
    form.amount_cents >= GIFT_CARD_MIN_CENTS && form.amount_cents <= GIFT_CARD_MAX_CENTS;
  const amountDollars = amountInRange ? form.amount_cents / 100 : 0;
  const amountLabel = form.amount_cents > 0 ? formatGiftCardDollars(form.amount_cents) : '$—';

  const coverage = useMemo(
    () => GIFT_CARD_COVERAGE.map((c) => ({ ...c, covered: amountDollars >= c.fromDollars })),
    [amountDollars],
  );
  const coveredCount = coverage.filter((c) => c.covered).length;
  const coverageSummary =
    amountDollars <= 0
      ? 'Enter an amount to see'
      : coveredCount === 0
        ? 'Goes toward any service'
        : coveredCount === coverage.length
          ? 'Covers any single service'
          : `${coveredCount} of ${coverage.length} fully covered`;

  // Required pieces filled, for the side rail (same meter as the quote form).
  const progress = useMemo(() => {
    const checks = [
      amountInRange,
      form.purchaser_name.trim().length > 0,
      EMAIL_RE.test(form.purchaser_email),
    ];
    if (form.delivery_type === 'recipient') {
      checks.push(form.recipient_name.trim().length > 0, EMAIL_RE.test(form.recipient_email));
    }
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [amountInRange, form]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (customMode) {
      const cents = parseCustomAmountToCents(customInput);
      if (cents === null) {
        next.amount_cents = 'Enter a whole-dollar amount.';
      } else if (cents < GIFT_CARD_MIN_CENTS || cents > GIFT_CARD_MAX_CENTS) {
        next.amount_cents = `Choose an amount between ${formatGiftCardDollars(
          GIFT_CARD_MIN_CENTS,
        )} and ${formatGiftCardDollars(GIFT_CARD_MAX_CENTS)}.`;
      }
    }
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

  const scrollToBuilder = () => {
    document.getElementById('build-gift-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const forName =
    form.delivery_type === 'recipient'
      ? form.recipient_name || 'Someone special'
      : form.purchaser_name || 'Yourself';

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>Furniture Assembly Gift Cards | Spring Hill, TN | Boxed2Built</title>
        <meta name="description" content="Give the gift of a stress-free move-in day. Boxed2Built service credit for furniture assembly and TV mounting in Spring Hill, TN. Perfect closing gift." />
        <link rel="canonical" href="https://boxed2built.com/gift-cards" />
        <meta property="og:url" content="https://boxed2built.com/gift-cards" />
        <meta property="og:title" content="Boxed2Built Gift Cards | The Perfect Closing or Housewarming Gift" />
        <meta property="og:description" content="Give the gift of professional furniture assembly. Boxed2Built gift cards for stress-free move-in days in Spring Hill, TN." />
        <meta name="twitter:title" content="Boxed2Built Gift Cards | Furniture Assembly in Spring Hill, TN" />
        <meta name="twitter:description" content="Give the gift of professional furniture assembly. Perfect for housewarmings and closing gifts." />
      </Head>
      <Header />
      <main className="pt-16">
        {/* ── Hero: mirrors the homepage hero ─────────────────────────── */}
        <section className="relative pt-20 md:pt-24 bg-[#0E2748] text-white overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto pt-6 pb-12 md:pt-10 md:pb-16 lg:pb-20">
              <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                <div className="w-full lg:w-[55%] min-w-0">
                  <span className="inline-flex items-center gap-2 border border-[#D9A441] text-[#E9BE6A] text-xs font-bold tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-full mb-5">
                    <Gift className="w-3.5 h-3.5" aria-hidden="true" /> Gift Cards
                  </span>
                  <h1 className="text-[2.25rem] leading-[1.08] md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-white mb-4 md:mb-5">
                    Give the Gift of a Finished Room
                    <span className="block mt-3 md:mt-4 text-xl md:text-2xl lg:text-[1.65rem] leading-snug font-medium tracking-normal text-[#D7DFEC]">
                      Assembly, Mounting &amp; Setup Credit{' '}
                      <span className="font-bold text-white border-b-[3px] border-[#D9A441] pb-0.5 whitespace-nowrap">
                        That Never Expires
                      </span>
                    </span>
                  </h1>
                  <p className="max-w-xl text-base md:text-[17px] leading-relaxed text-[#C9D2E6] mb-5">
                    The perfect housewarming, wedding, or thank-you gift. Credit toward furniture
                    assembly, TV mounting, and any Boxed2Built service in Spring Hill, TN.
                  </p>

                  {ratingStats.totalReviews > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-7 md:mb-8">
                      <StarRating rating={ratingStats.averageRating} size={20} />
                      <span className="text-sm md:text-base font-semibold text-white">
                        {ratingStats.averageRating.toFixed(1)} from {ratingStats.totalReviews} Google Reviews
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-3.5">
                    <button
                      type="button"
                      onClick={scrollToBuilder}
                      className="group inline-flex w-full sm:w-auto min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#D9A441] hover:bg-[#E9BE6A] text-[#0E2748] px-7 md:px-8 py-4 text-base md:text-lg font-extrabold shadow-[0_10px_24px_rgba(217,164,65,0.28)] hover:shadow-[0_14px_30px_rgba(217,164,65,0.4)] hover:-translate-y-px transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
                    >
                      Build a Gift Card
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </button>
                    <a
                      href={`tel:${phoneRaw}`}
                      className="inline-flex w-full sm:w-auto min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#13807A] hover:bg-[#0F6B66] text-white px-6 py-4 text-base md:text-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
                      aria-label={`Call Boxed2Built at ${phoneDisplay}`}
                    >
                      <Phone className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      {phoneDisplay}
                    </a>
                  </div>
                </div>

                {/* Live card preview in the homepage's gold offset frame */}
                <div className="w-full lg:w-[45%] min-w-0">
                  <div className="relative pt-3 pr-3 md:pt-[18px] md:pr-[18px] max-w-[520px] mx-auto">
                    <div aria-hidden="true" className="absolute top-0 right-0 bottom-3 left-3 md:bottom-[18px] md:left-[18px] rounded-[26px] border-2 border-[#D9A441] pointer-events-none" />
                    <GiftCardPreview amountLabel={amountLabel} forName={forName} fromName={form.purchaser_name || 'You'} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust bar — same treatment as the homepage */}
          <div className="relative z-10 bg-[#091C38] border-t border-[#D9A441]/45">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto grid grid-cols-3 divide-x divide-white/10">
                <TrustItem icon={InfinityIcon} label="Never Expires" />
                <TrustItem icon={ShieldCheck} label="Secure Stripe Checkout" />
                <TrustItem icon={MapPin} label="Locally Owned" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Builder ─────────────────────────────────────────────────── */}
        <section id="build-gift-card" className="scroll-mt-24 py-12 md:py-16 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Build Your Gift Card</h2>
                <p className="text-xl text-gray-600">
                  Three quick steps. Pay securely on Stripe, and the code goes straight to their inbox — or yours.
                </p>
              </div>

              <div className="relative">
                <FormProgressRail progress={progress} />
                <div className="-mx-4 sm:mx-0 bg-[radial-gradient(1200px_500px_at_50%_-180px,#FBF8F1_0%,#F5EFE3_60%)] sm:rounded-3xl px-5 py-8 sm:px-6">
                  <form onSubmit={handleSubmit} noValidate className="max-w-[760px] mx-auto flex flex-col gap-[22px]">
                    {/* Step 1 — amount + what it covers */}
                    <section className={cardCls} aria-labelledby="gc-amount-title">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className={stepBadgeCls} aria-hidden="true">1</span>
                        <h3 id="gc-amount-title" className="text-[19px] font-bold text-[#0E2748] m-0">Pick an amount</h3>
                        <span className="text-[11px] font-bold tracking-[0.04em] uppercase text-[#B45309] bg-[#FDF3E3] border border-[#F1D9AE] px-2.5 py-[3px] rounded-full">Required</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-[18px] sm:ml-9">Not sure? See what each amount covers below.</p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="gc-amount-title">
                        {GIFT_CARD_DENOMINATIONS.map((d) => {
                          const selected = !customMode && d.amountCents === form.amount_cents;
                          return (
                            <AmountTile
                              key={d.amountCents}
                              selected={selected}
                              onClick={() => selectPreset(d.amountCents)}
                              title={d.label}
                              sub={coverageHint(d.dollars)}
                            />
                          );
                        })}
                        <AmountTile
                          selected={customMode}
                          onClick={chooseCustom}
                          title="Custom"
                          sub={`${formatGiftCardDollars(GIFT_CARD_MIN_CENTS)} – ${formatGiftCardDollars(GIFT_CARD_MAX_CENTS)}`}
                          icon={PenLine}
                        />
                      </div>

                      {customMode && (
                        <div className="mt-4 max-w-xs">
                          <label htmlFor="custom_amount" className={labelCls}>
                            Custom amount {requiredMark}
                          </label>
                          <div className="relative">
                            <span className="absolute top-1/2 -translate-y-1/2 left-4 text-lg font-semibold text-gray-500" aria-hidden="true">$</span>
                            <input
                              ref={customInputRef}
                              id="custom_amount"
                              type="text"
                              inputMode="numeric"
                              value={customInput}
                              onChange={(e) => onCustomInputChange(e.target.value)}
                              placeholder="75"
                              aria-invalid={!!errors.amount_cents}
                              aria-describedby={errors.amount_cents ? 'custom_amount-err' : 'custom_amount-help'}
                              className={inputCls(!!errors.amount_cents, 'pl-9 text-lg font-semibold')}
                            />
                          </div>
                          {errors.amount_cents ? (
                            <p id="custom_amount-err" className="mt-1.5 text-xs text-red-600" role="alert">{errors.amount_cents}</p>
                          ) : (
                            <p id="custom_amount-help" className="mt-1.5 text-xs text-gray-500">Whole dollars only.</p>
                          )}
                        </div>
                      )}

                      {/* What this covers */}
                      <div className="mt-5 bg-[#0E2748] text-white rounded-2xl p-5 sm:p-6" aria-live="polite">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                          <h4 className="text-lg font-bold m-0">What {amountInRange ? amountLabel : 'your gift'} covers</h4>
                          <span className="text-sm text-[#C9D2E6]">{coverageSummary}</span>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {coverage.map((c) => (
                            <li
                              key={c.label}
                              className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-[15px] transition-colors duration-200 ${
                                c.covered ? 'bg-[#D9A441]/15 text-white' : 'bg-white/[0.04] text-[#AEB8CC]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                {c.covered ? (
                                  <Check className="w-[18px] h-[18px] text-[#D9A441] flex-shrink-0" strokeWidth={2.5} aria-label="Covered" />
                                ) : (
                                  <Circle className="w-[18px] h-[18px] text-[#6E7A93] flex-shrink-0" aria-label="Not fully covered" />
                                )}
                                {c.label}
                              </span>
                              <span className="font-bold whitespace-nowrap">from ${c.fromDollars}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-[13px] leading-relaxed text-[#C9D2E6]">
                          Based on starting prices. Credit applies to any service, and leftover balances roll over for future jobs.
                        </p>
                      </div>
                    </section>

                    {/* Step 2 — who it's for */}
                    <section className={cardCls} aria-labelledby="gc-who-title">
                      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                        <span className={stepBadgeCls} aria-hidden="true">2</span>
                        <h3 id="gc-who-title" className="text-[19px] font-bold text-[#0E2748] m-0">Who's it for?</h3>
                        <span className="ml-auto text-xs text-gray-400">{requiredMark} required</span>
                      </div>

                      <div className="flex justify-center mb-5">
                        <div className="inline-flex bg-[#F5EFE3] border border-[#ECE3D2] rounded-full p-1" role="radiogroup" aria-label="Delivery">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.delivery_type === 'recipient'}
                            onClick={() => set('delivery_type', 'recipient')}
                            className={`inline-flex items-center gap-[7px] px-5 py-[9px] min-h-[44px] rounded-full text-sm font-bold transition-all duration-200 ${
                              form.delivery_type === 'recipient' ? 'bg-[#0E2748] text-[#FBF8F1]' : 'bg-transparent text-[#0E2748]'
                            }`}
                          >
                            <Gift size={16} aria-hidden="true" /> Send as a gift
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.delivery_type === 'self'}
                            onClick={() => set('delivery_type', 'self')}
                            className={`inline-flex items-center gap-[7px] px-5 py-[9px] min-h-[44px] rounded-full text-sm font-bold transition-all duration-200 ${
                              form.delivery_type === 'self' ? 'bg-[#0E2748] text-[#FBF8F1]' : 'bg-transparent text-[#0E2748]'
                            }`}
                          >
                            <Mail size={16} aria-hidden="true" /> Send to me
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 text-center -mt-2 mb-5">
                        {form.delivery_type === 'recipient'
                          ? "We'll email the code straight to them."
                          : "We'll email the code to you so you can hand it over yourself."}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <TextField id="purchaser_name" label="Your name" value={form.purchaser_name} onChange={(v) => set('purchaser_name', v)} error={errors.purchaser_name} autoComplete="name" placeholder="John Smith" />
                        <TextField id="purchaser_email" label="Your email" type="email" value={form.purchaser_email} onChange={(v) => set('purchaser_email', v)} error={errors.purchaser_email} autoComplete="email" placeholder="john@example.com" />
                        {form.delivery_type === 'recipient' && (
                          <>
                            <TextField id="recipient_name" label="Recipient's name" value={form.recipient_name} onChange={(v) => set('recipient_name', v)} error={errors.recipient_name} autoComplete="off" placeholder="Jane Smith" />
                            <TextField id="recipient_email" label="Recipient's email" type="email" value={form.recipient_email} onChange={(v) => set('recipient_email', v)} error={errors.recipient_email} autoComplete="off" placeholder="jane@example.com" />
                          </>
                        )}
                      </div>
                    </section>

                    {/* Step 3 — note (gifts only, as before) */}
                    {form.delivery_type === 'recipient' && (
                      <section className={cardCls} aria-labelledby="gc-note-title">
                        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                          <span className={stepBadgeCls} aria-hidden="true">3</span>
                          <h3 id="gc-note-title" className="text-[19px] font-bold text-[#0E2748] m-0">Add a personal note</h3>
                          <span className="text-[11px] font-bold tracking-[0.04em] uppercase text-[#11625E] bg-[#EEF4F3] border border-[#CFE3E1] px-2.5 py-[3px] rounded-full">Optional</span>
                        </div>
                        <label htmlFor="personal_message" className={labelCls}>Message</label>
                        <textarea
                          id="personal_message"
                          rows={4}
                          maxLength={500}
                          value={form.personal_message}
                          onChange={(e) => set('personal_message', e.target.value)}
                          className={`${inputCls(false)} resize-none`}
                          placeholder="Add a note they'll see in the email…"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-right">{form.personal_message.length}/500</p>
                      </section>
                    )}

                    {/* Checkout bar — same navy bar as the quote form's summary */}
                    <div className="flex items-center justify-between gap-4 flex-wrap bg-[#0E2748] rounded-[20px] px-6 py-5 shadow-[0_14px_34px_rgba(14,39,72,0.22)] text-white">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#C9D2E6]">Gift card total</p>
                        <p className="text-3xl font-extrabold tracking-tight">{amountLabel}</p>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting || form.amount_cents <= 0}
                        className="group inline-flex w-full sm:w-auto min-h-[56px] items-center justify-center gap-2.5 rounded-xl bg-[#D9A441] hover:bg-[#E9BE6A] disabled:opacity-60 disabled:cursor-not-allowed text-[#0E2748] px-7 py-4 text-base md:text-lg font-extrabold shadow-[0_10px_24px_rgba(217,164,65,0.28)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Starting checkout…
                          </>
                        ) : (
                          <>
                            Continue to Checkout
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                          </>
                        )}
                      </button>
                      <p className="basis-full text-xs text-[#C9D2E6] leading-relaxed">
                        You'll complete payment securely on Stripe. Your credit never expires and is redeemable
                        only for Boxed2Built services.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section className="bg-white py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-10">How It Works</h2>
              <ol className="grid md:grid-cols-3 gap-5">
                <HowStep icon={CreditCard} title="1. Choose an amount" text="Pick $25 to $200, or any custom amount from $10 to $1,000, and who it's for." />
                <HowStep icon={Mail} title="2. We email the code" text="The code goes to you or straight to your recipient, along with your note." />
                <HowStep icon={Check} title="3. Redeem on a quote" text="Enter the code when requesting a quote — we apply it as credit on the final invoice." />
              </ol>
            </div>
          </div>
        </section>

        {/* ── Redeem band ─────────────────────────────────────────────── */}
        <section className="bg-[#0E2748] text-white py-12 md:py-14">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Already have a code?</h2>
                <p className="mt-2 text-[#C9D2E6] text-base md:text-lg">
                  Add it when you request your free quote. Balances roll over for future services.
                </p>
              </div>
              <a
                href="/redeem-gift-card"
                className="group inline-flex w-full md:w-auto min-h-[56px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#13807A] hover:bg-[#0F6B66] text-white px-7 py-4 text-base md:text-lg font-bold shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E2748]"
              >
                Redeem a Gift Card
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

function inputCls(hasError: boolean, extra = ''): string {
  const base =
    'w-full px-3.5 py-3 rounded-xl text-base text-gray-900 outline-none border-[1.5px] transition-[border-color,box-shadow] duration-200 placeholder:text-gray-400 focus:border-[#D9A441] focus:shadow-[0_0_0_3px_rgba(217,164,65,0.22)]';
  return `${base} ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'} ${extra}`;
}

function GiftCardPreview({ amountLabel, forName, fromName }: { amountLabel: string; forName: string; fromName: string }) {
  return (
    <div className="relative rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.35)] bg-[#091C38] aspect-[1.586/1] p-6 sm:p-8 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <img src="/boxed2built_logo_white.svg" alt="Boxed2Built" className="h-10 sm:h-12 w-auto opacity-95" />
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] text-[#E9BE6A]">Service Credit</span>
      </div>
      <p className="text-6xl sm:text-7xl font-extrabold tracking-tight leading-none" aria-live="polite">{amountLabel}</p>
      <div className="flex items-end justify-between gap-6 text-sm">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-[#9FB0CC]">For</p>
          <p className="text-base sm:text-lg font-semibold truncate">{forName}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11px] uppercase tracking-widest text-[#9FB0CC]">From</p>
          <p className="text-base sm:text-lg font-semibold truncate">{fromName}</p>
        </div>
      </div>
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 md:py-6 text-center">
      <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#D9A441] flex-shrink-0" aria-hidden="true" />
      <span className="text-xs md:text-base font-bold text-white">{label}</span>
    </div>
  );
}

function AmountTile({
  selected,
  onClick,
  title,
  sub,
  icon: Icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  icon?: React.ElementType;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`relative text-left rounded-2xl border-2 border-[#ECE3D2] px-4 py-4 min-h-[104px] flex flex-col gap-1 transition-[box-shadow,background-color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${
        selected
          ? 'bg-[#FBF8F1] shadow-[0_0_0_2px_#D9A441,0_8px_20px_rgba(217,164,65,0.18)]'
          : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(14,39,72,0.08)]'
      }`}
    >
      <span className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#0E2748]">
        {Icon && <Icon className="w-5 h-5" aria-hidden="true" />}
        {title}
      </span>
      <span className="text-[13px] leading-snug text-gray-500">{sub}</span>
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#D9A441] text-[#0E2748] inline-flex items-center justify-center" aria-hidden="true">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  error,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} {requiredMark}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputCls(!!error)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function HowStep({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <li className="list-none rounded-[20px] border border-[#ECE3D2] bg-white p-6 shadow-[0_10px_30px_rgba(14,39,72,0.05)]">
      <span className="w-[46px] h-[46px] rounded-xl bg-[#F5EFE3] text-[#0E2748] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-bold text-[#0E2748]">{title}</h3>
      <p className="mt-1.5 text-[15px] text-gray-600 leading-relaxed">{text}</p>
    </li>
  );
}

export default GiftCardsPage;
