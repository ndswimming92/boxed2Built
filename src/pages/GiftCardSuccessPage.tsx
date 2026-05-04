import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Copy, Gift, Mail, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { getGiftCardConfirmation, GiftCardConfirmation } from '../services/giftCardService';
import { formatGiftCardDollars } from '../constants/giftCards';
import { useToast } from '../contexts/ToastContext';

const GiftCardSuccessPage: React.FC = () => {
  usePageMeta({
    title: 'Gift Card Purchase Complete | Boxed2Built',
    description: 'Thanks for supporting Boxed2Built. Your gift card purchase is confirmed and on its way.',
    canonicalUrl: 'https://boxed2built.com/gift-cards/success',
    ogTitle: 'Gift Card Purchase Complete | Boxed2Built',
    ogDescription: 'Your Boxed2Built gift card purchase is confirmed. The recipient will love stress-free furniture assembly.',
    twitterTitle: 'Gift Card Purchase Complete | Boxed2Built',
    twitterDescription: 'Your Boxed2Built gift card purchase is confirmed.',
  });

  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<GiftCardConfirmation | null>(null);
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const data = await getGiftCardConfirmation(sessionId);
        if (cancelled) return;
        if (data && (data.status === 'active' || data.status === 'partially_redeemed' || data.status === 'redeemed')) {
          setConfirmation(data);
          setPending(false);
          setLoading(false);
          return;
        }
        // Still pending webhook
        setConfirmation(data);
        setPending(true);
        if (attempts < 8) {
          setTimeout(poll, 1500);
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const copyCode = async () => {
    if (!confirmation?.code) return;
    await navigator.clipboard.writeText(confirmation.code);
    showToast({ message: 'Code copied!', type: 'success' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="pt-28 pb-20 min-h-[60vh]">
        <section className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10 text-center">
            {loading ? (
              <div className="py-12">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                <p className="mt-4 text-slate-600">Finalizing your purchase…</p>
              </div>
            ) : confirmation && !pending ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <h1 className="mt-5 text-3xl font-bold text-slate-900">Gift card on the way!</h1>
                <p className="mt-3 text-slate-600 leading-relaxed">
                  Thanks{confirmation.purchaser_first_name ? `, ${confirmation.purchaser_first_name}` : ''}. Your purchase of{' '}
                  <strong>{formatGiftCardDollars(confirmation.amount_cents)}</strong> is complete.
                </p>

                {confirmation.delivery_type === 'self' && confirmation.code ? (
                  <div className="mt-8 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-600 text-white p-6">
                    <p className="text-xs uppercase tracking-widest opacity-80">Your gift card code</p>
                    <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-wider">
                      {confirmation.code}
                    </p>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="mt-4 inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 transition px-3 py-1.5 rounded-lg text-sm"
                    >
                      <Copy className="w-4 h-4" /> Copy code
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-6 text-left">
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-emerald-700 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          We've sent the gift card
                          {confirmation.recipient_first_name ? ` to ${confirmation.recipient_first_name}` : ' to the recipient'}.
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          They'll receive a branded email with the code and a link to redeem it.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="mt-6 text-sm text-slate-500">
                  A receipt has been emailed to you. Your credit never expires.
                </p>

                <div className="mt-8 flex gap-3 justify-center">
                  <Link to="/">
                    <Button variant="outline">Back to home</Button>
                  </Link>
                  <Link to="/gift-cards">
                    <Button variant="primary">
                      <Gift className="w-4 h-4 mr-2" /> Buy another
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                  <Loader2 className="w-9 h-9 text-amber-600 animate-spin" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-slate-900">Almost there…</h2>
                <p className="mt-2 text-slate-600">
                  Your payment was received. We're finalizing your gift card — this usually takes just a few seconds.
                  Refresh the page if it doesn't update shortly.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default GiftCardSuccessPage;
