import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

const CONSENT_LABEL =
  'I agree to receive a text message reply from Boxed2Built at this number about my question. Msg&data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const TextUsButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', message: '', website: '' });
  const [consent, setConsent] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-question`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, consent, page_url: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please call us instead.');
        setStatus('error');
        return;
      }
      trackEvent('text-us-submit');
      setStatus('sent');
      setForm({ name: '', phone: '', message: '', website: '' });
      setConsent(false);
    } catch {
      setError('Something went wrong. Please call us instead.');
      setStatus('error');
    }
  };

  const toggle = () => {
    setOpen((o) => !o);
    if (status === 'sent') setStatus('idle');
    trackEvent('text-us-open');
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Text us a question"
          className="fixed bottom-20 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-white shadow-2xl border border-gray-200"
        >
          <div className="flex items-center justify-between bg-blue-600 text-white rounded-t-xl px-4 py-3">
            <span className="font-semibold">Text us a question</span>
            <button onClick={toggle} aria-label="Close" className="hover:opacity-80">
              <X size={18} />
            </button>
          </div>
          {status === 'sent' ? (
            <p className="p-4 text-sm text-gray-700">Thanks! We got your message and will text you back soon.</p>
          ) : (
            <form onSubmit={submit} className="p-4 space-y-3 text-sm">
              <input
                required maxLength={100} value={form.name} onChange={set('name')}
                placeholder="Your name" autoComplete="name"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
              <input
                required type="tel" maxLength={30} value={form.phone} onChange={set('phone')}
                placeholder="Mobile number" autoComplete="tel"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
              <textarea
                required minLength={3} maxLength={600} rows={3} value={form.message} onChange={set('message')}
                placeholder="Your question"
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
              {/* Honeypot: hidden from people, filled in by bots. */}
              <input
                tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')}
                className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website"
              />
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span>{CONSENT_LABEL}</span>
              </label>
              {status === 'error' && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit" disabled={status === 'sending'}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Send size={16} /> {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </form>
          )}
        </div>
      )}
      <button
        onClick={toggle}
        className="fixed bottom-6 left-4 sm:left-6 p-3 bg-blue-600 bg-opacity-80 hover:bg-opacity-100 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50"
        aria-label="Text us a question"
        aria-expanded={open}
      >
        <MessageCircle size={20} />
      </button>
    </>
  );
};

export default TextUsButton;
