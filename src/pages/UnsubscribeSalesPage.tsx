import React, { useState } from 'react';
import { Head } from 'vite-react-ssg';
import { CheckCircle, MailX } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { unsubscribeFromSales } from '../services/salesSubscriptionService';

/**
 * Landing page for the unsubscribe link in every sales email. Opting out takes
 * one click here, not on page load, so a mail scanner that follows links
 * cannot unsubscribe someone by accident.
 */
const UnsubscribeSalesPage: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Read on click rather than at render: the pre-rendered page has no link.
  const token = () => new URLSearchParams(window.location.search).get('token') ?? '';

  const handleUnsubscribe = async () => {
    setError(null);
    setStatus('working');
    try {
      await unsubscribeFromSales(token());
      setStatus('done');
    } catch (unsubscribeError) {
      setStatus('idle');
      setError(
        unsubscribeError instanceof Error ? unsubscribeError.message : 'Something went wrong. Please try again.',
      );
    }
  };

  return (
    <>
      <Head>
        <title>Unsubscribe from sales emails | Boxed2Built</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Header />
      <main className="pt-20">
        <section className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center shadow-md">
              {status === 'done' ? (
                <>
                  <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-600" aria-hidden="true" />
                  <h1 className="mb-3 text-2xl font-bold text-gray-900">You're unsubscribed</h1>
                  <p className="mb-6 text-gray-600">
                    You won't get any more sales emails from us. You can sign up again any time on the Deals &amp;
                    News page.
                  </p>
                  <a href="/news" className="font-medium text-blue-700 underline hover:text-blue-800">
                    Back to Deals &amp; News
                  </a>
                </>
              ) : (
                <>
                  <MailX className="mx-auto mb-4 h-12 w-12 text-gray-400" aria-hidden="true" />
                  <h1 className="mb-3 text-2xl font-bold text-gray-900">Unsubscribe from sales emails?</h1>
                  <p className="mb-6 text-gray-600">
                    This stops all future emails about new furniture sales.
                  </p>
                  {error && (
                    <p role="alert" className="mb-4 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={status === 'working'}
                    className="rounded-lg bg-brand-navy px-7 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === 'working' ? 'Unsubscribing...' : 'Yes, unsubscribe me'}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default UnsubscribeSalesPage;
