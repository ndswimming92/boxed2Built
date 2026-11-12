import React, { useLayoutEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { caretAfterDigits, formatPhoneInput, phoneDigitsOnly, validatePhoneInput } from '../../utils/phoneInput';

const CONSENT_LABEL =
  'I agree to receive a text message reply from Boxed2Built at this number about my question. Msg&data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type Field = 'name' | 'phone' | 'message' | 'consent';

const INPUT = 'w-full rounded-md border px-3 py-2';
const inputClass = (bad: boolean) => `${INPUT} ${bad ? 'border-red-500 focus:outline-red-500' : 'border-gray-300'}`;

function fieldErrors(form: { name: string; phone: string; message: string }, consent: boolean, complete: Record<Field, boolean>) {
  const errors: Partial<Record<Field, string>> = {};
  if (complete.name && !form.name.trim()) errors.name = 'Enter your name.';
  const phoneError = validatePhoneInput(form.phone, complete.phone);
  if (phoneError) errors.phone = phoneError;
  if (complete.message) {
    if (!form.message.trim()) errors.message = 'Enter your question.';
    else if (form.message.trim().length < 3) errors.message = 'Please add a little more detail.';
  }
  if (complete.consent && !consent) errors.consent = 'Please tick the box so we can text you back.';
  return errors;
}

const TextUsButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', message: '', website: '' });
  const [consent, setConsent] = useState(false);
  // A field counts as "finished" once the visitor leaves it or tries to send.
  const [touched, setTouched] = useState<Record<Field, boolean>>({ name: false, phone: false, message: false, consent: false });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  // Reformatting replaces the field's text, which would throw the cursor to the end. When the
  // visitor edits in the middle, remember which digit the cursor was on and put it back.
  const phoneRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const setPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = e.target;
    const formatted = formatPhoneInput(value);
    // Every edit sets or clears the position, so one edit's position can never carry over to the next.
    pendingCaret.current =
      selectionStart !== null && selectionStart < value.length
        ? caretAfterDigits(formatted, phoneDigitsOnly(value.slice(0, selectionStart)).length)
        : null;
    setForm((f) => ({ ...f, phone: formatted }));
  };
  // No dependency list on purpose: an edit that leaves the formatted text unchanged (deleting a
  // hyphen the formatter puts straight back) still re-renders, and its position must be used then.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && phoneRef.current) {
      phoneRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });
  const touch = (field: Field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const errors = fieldErrors(form, consent, touched);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const all = { name: true, phone: true, message: true, consent: true };
    setTouched(all);
    const problems = fieldErrors(form, consent, all);
    const first = (['name', 'phone', 'message', 'consent'] as Field[]).find((f) => problems[f]);
    if (first) {
      document.getElementById(`text-us-${first}`)?.focus();
      return;
    }
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
      setTouched({ name: false, phone: false, message: false, consent: false });
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
          className="fixed bottom-20 left-4 sm:left-6 z-60 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-white shadow-2xl border border-gray-200 isolate"
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
            <form onSubmit={submit} noValidate className="p-4 space-y-3 text-sm">
              <div>
                <input
                  id="text-us-name" maxLength={100} value={form.name} onChange={set('name')} onBlur={touch('name')}
                  placeholder="Your name" autoComplete="name"
                  aria-invalid={!!errors.name} aria-describedby={errors.name ? 'text-us-name-error' : undefined}
                  className={inputClass(!!errors.name)}
                />
                {errors.name && <p id="text-us-name-error" role="alert" className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <input
                  id="text-us-phone" ref={phoneRef} type="tel" inputMode="tel" maxLength={22} value={form.phone}
                  onChange={setPhone} onBlur={touch('phone')}
                  placeholder="Mobile number, e.g. (615) 555-0123" autoComplete="tel-national"
                  aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'text-us-phone-error' : undefined}
                  className={inputClass(!!errors.phone)}
                />
                {errors.phone && <p id="text-us-phone-error" role="alert" className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <textarea
                  id="text-us-message" maxLength={600} rows={3} value={form.message} onChange={set('message')} onBlur={touch('message')}
                  placeholder="Your question"
                  aria-invalid={!!errors.message} aria-describedby={errors.message ? 'text-us-message-error' : undefined}
                  className={inputClass(!!errors.message)}
                />
                <div className="mt-1 flex justify-between text-xs">
                  <span id="text-us-message-error" role={errors.message ? 'alert' : undefined} className="text-red-600">{errors.message}</span>
                  <span className={form.message.length >= 550 ? 'text-amber-600' : 'text-gray-400'}>{form.message.length}/600</span>
                </div>
              </div>
              {/* Honeypot: hidden from people, filled in by bots. */}
              <input
                tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')}
                className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website"
              />
              <div>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input
                    id="text-us-consent" type="checkbox" checked={consent}
                    onChange={(e) => { setConsent(e.target.checked); setTouched((t) => ({ ...t, consent: true })); }}
                    aria-invalid={!!errors.consent} className="mt-0.5"
                  />
                  <span>{CONSENT_LABEL}</span>
                </label>
                {errors.consent && <p role="alert" className="mt-1 text-xs text-red-600">{errors.consent}</p>}
              </div>
              {status === 'error' && <p role="alert" className="text-xs text-red-600">{error}</p>}
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
        className="fixed bottom-6 left-4 sm:left-6 p-3 bg-blue-600/80 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50"
        aria-label="Text us a question"
        aria-expanded={open}
      >
        <MessageCircle size={20} />
      </button>
    </>
  );
};

export default TextUsButton;
