import React, { useId, useState } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { subscribeToSales } from '../../services/salesSubscriptionService';
import { trackEvent } from '../../utils/analytics';

/**
 * "Email me the new sales" sign-up, shown on the Sales tab. Name and email are
 * all that is asked for. The `website` input is a honeypot: positioned off
 * screen and skipped by keyboards and screen readers, so only bots fill it.
 */
const SalesSubscribeCard: React.FC = () => {
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    setError(null);
    setStatus('sending');
    try {
      await subscribeToSales({ name, email, website });
      setStatus('done');
      trackEvent('form_submit', 'sales_subscribe', { event_category: 'engagement', event_label: 'sales_email' });
    } catch (submitError) {
      setStatus('idle');
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
    }
  };

  if (status === 'done') {
    return (
      <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle className="mt-0.5 h-6 w-6 flex-none text-emerald-700" aria-hidden="true" />
        <div>
          <p className="font-semibold text-emerald-900">You're subscribed!</p>
          <p className="mt-1 text-sm text-emerald-900">
            We sent a welcome email to {email.trim()}. From now on you'll get the new sales each morning.
            Every email has an unsubscribe link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-heading`}
      className="mb-6 rounded-lg border border-brand-gold/40 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-6 w-6 flex-none text-brand-gold" aria-hidden="true" />
        <div>
          <h3 id={`${id}-heading`} className="text-lg font-bold text-brand-navy">
            Get new furniture sales by email
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            One email each morning with the sales we added, only on days there is something new. Unsubscribe any time.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id={`${id}-name`}
            type="text"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-lg bg-brand-navy px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Subscribing...' : 'Subscribe'}
        </button>
        <p className="text-xs text-gray-500">
          We only use your name and email for this list. See our{' '}
          <a href="/privacy-policy" className="underline hover:text-gray-700">
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  );
};

export default SalesSubscribeCard;
