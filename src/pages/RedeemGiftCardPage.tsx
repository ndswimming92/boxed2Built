import { Head } from 'vite-react-ssg';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Gift, Search, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/ui/Button';
import { formatGiftCardCodeInput, isValidGiftCardCode, normalizeGiftCardCode } from '../utils/giftCardCode';
import { formatGiftCardDollars } from '../constants/giftCards';
import { lookupGiftCardByCode } from '../services/giftCardService';
import type { GiftCardLookupResult } from '../types/giftCard';

const RedeemGiftCardPage: React.FC = () => {

  const [params] = useSearchParams();
  const [code, setCode] = useState(() => formatGiftCardCodeInput(params.get('code') || ''));
  const [result, setResult] = useState<GiftCardLookupResult | null>(null);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const lookup = async (raw: string) => {
    setChecking(true);
    setError(null);
    try {
      const data = await lookupGiftCardByCode(normalizeGiftCardCode(raw));
      setResult(data);
      setChecked(true);
    } catch (e) {
      setResult(null);
      setChecked(true);
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const prefill = params.get('code');
    if (prefill && isValidGiftCardCode(prefill)) {
      lookup(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidGiftCardCode(code)) {
      setError('Gift card codes look like B2B-XXXX-XXXX.');
      return;
    }
    lookup(code);
  };

  const continueToQuote = () => {
    const clean = normalizeGiftCardCode(code);
    navigate(`/contact?gift_card_code=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>Redeem a Gift Card | Check Your Balance | Boxed2Built</title>
        <meta name="description" content="Check your balance and apply a Boxed2Built gift card to your next furniture assembly or TV mounting service in Spring Hill, TN. Takes under a minute." />
        <link rel="canonical" href="https://boxed2built.com/redeem-gift-card" />
        <meta property="og:url" content="https://boxed2built.com/redeem-gift-card" />
        <meta property="og:title" content="Redeem a Boxed2Built Gift Card" />
        <meta property="og:description" content="Check your gift card balance and apply credit toward your next Boxed2Built furniture assembly service." />
        <meta name="twitter:title" content="Redeem a Boxed2Built Gift Card" />
        <meta name="twitter:description" content="Check your gift card balance and apply credit toward your next service." />
      </Head>
      <Header />
      <main className="pt-28 pb-20">
        <section className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <div className="inline-flex w-12 h-12 rounded-full bg-emerald-50 items-center justify-center">
              <Gift className="w-6 h-6 text-emerald-700" />
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900">Redeem your gift card</h1>
            <p className="mt-3 text-slate-600">
              Enter your gift card code to check the balance and apply it to a new quote.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-2">
              Gift card code
            </label>
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-slate-400" />
              <input
                id="code"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => {
                  setCode(formatGiftCardCodeInput(e.target.value));
                  setError(null);
                }}
                className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none font-mono tracking-wider text-lg"
                placeholder="B2B-XXXX-XXXX"
                aria-invalid={!!error}
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-3">
              <Button type="submit" variant="primary" className="flex-1" loading={checking} disabled={checking}>
                Check balance
              </Button>
            </div>
          </form>

          {checked && !checking && (
            <div className="mt-6">
              {!result ? (
                <StatusCard
                  tone="error"
                  icon={XCircle}
                  title="We couldn't find that code"
                  body="Double-check the code and try again, or reach out to us if you think something's wrong."
                />
              ) : result.status === 'voided' ? (
                <StatusCard
                  tone="error"
                  icon={AlertTriangle}
                  title="This gift card has been voided"
                  body="Please contact us so we can look into it."
                />
              ) : result.status === 'redeemed' || result.remaining_amount_cents === 0 ? (
                <StatusCard
                  tone="neutral"
                  icon={AlertTriangle}
                  title="This gift card has been fully redeemed"
                  body="No balance remaining. Thanks for using Boxed2Built!"
                />
              ) : (
                <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-600 text-white p-6 sm:p-8">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="text-sm font-semibold tracking-wide uppercase">Gift card is active</p>
                  </div>
                  <p className="mt-3 text-sm opacity-85">Remaining balance</p>
                  <p className="text-5xl font-extrabold mt-1">
                    {formatGiftCardDollars(result.remaining_amount_cents)}
                  </p>
                  {result.remaining_amount_cents < result.initial_amount_cents && (
                    <p className="text-xs opacity-80 mt-1">
                      of {formatGiftCardDollars(result.initial_amount_cents)} original value
                    </p>
                  )}
                  <div className="mt-6">
                    <Button
                      variant="white"
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={continueToQuote}
                    >
                      Continue to quote <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <p className="mt-4 text-xs opacity-85">
                    We'll apply your credit when we finalize your invoice. Partial balances roll over and never expire.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
              Don't have a code yet?{' '}
              <Link to="/gift-cards" className="text-emerald-700 font-semibold hover:underline">
                Buy a gift card
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

function StatusCard({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: 'success' | 'error' | 'neutral';
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === 'error'
      ? 'bg-red-50 border-red-200 text-red-900'
      : tone === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : 'bg-slate-50 border-slate-200 text-slate-800';
  const iconClass =
    tone === 'error' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-500';
  return (
    <div className={`rounded-2xl border p-5 flex items-start gap-3 ${toneClass}`}>
      <Icon className={`w-5 h-5 mt-0.5 ${iconClass}`} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export default RedeemGiftCardPage;
