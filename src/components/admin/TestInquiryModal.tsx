import { useMemo, useState } from 'react';
import { X, FlaskConical, Minus, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createInquiry } from '../../services/inquiryService';
import { createSavedRequest } from '../../services/savedRequestService';
import { FURNITURE, type FurnitureId } from '../../utils/furnitureCatalog';

interface TestInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the new inquiry's id once it is saved. */
  onSubmitted: (inquiryId: string) => void;
}

const MAX_PER_TYPE = 20;

const emptyQty = (): Record<FurnitureId, number> =>
  ({ Chair: 0, Table: 0, Bed: 0, Dresser: 0, Bookshelf: 0, IKEA: 0, Other: 0 });

// A fresh address each time, so every test makes its own test client instead of
// piling onto one. example.com is reserved and can never reach a real person.
const sampleEmail = () => `test.customer+${Date.now().toString(36)}@example.com`;

const freshValues = () => ({
  name: 'Test Customer',
  email: sampleEmail(),
  phone: '(555) 010-0199',
  preferredDate: '',
  preferredTimeSlot: 'morning',
  clientType: 'residential' as 'residential' | 'business',
  notes: 'This is a test submission from the admin portal.',
});

export default function TestInquiryModal({ isOpen, onClose, onSubmitted }: TestInquiryModalProps) {
  const [values, setValues] = useState(freshValues);
  const [qty, setQty] = useState<Record<FurnitureId, number>>(() => ({ ...emptyQty(), Table: 1, Chair: 2 }));
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimate = useMemo(() => {
    const selected = FURNITURE.filter((f) => qty[f.id] > 0);
    const totalItems = selected.reduce((n, f) => n + qty[f.id], 0);
    const totalMinutes = selected.reduce((n, f) => n + qty[f.id] * f.minutes, 0);
    const rawPrice = selected.reduce((n, f) => n + qty[f.id] * f.price, 0);
    // Same volume discount and rounding as the public form.
    const price = Math.round(totalItems > 3 ? rawPrice * 0.9 : rawPrice);
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    const primaryType = selected.length
      ? [...selected].sort((a, b) => qty[b.id] - qty[a.id])[0].id
      : '';
    const breakdown = selected
      .map((f) => `${f.id === 'Other' && otherText.trim() ? `Other (${otherText.trim()})` : f.label} ×${qty[f.id]}`)
      .join(', ');
    return { selected, totalItems, price, hours, primaryType, breakdown };
  }, [qty, otherText]);

  if (!isOpen) return null;

  const setValue = <K extends keyof ReturnType<typeof freshValues>>(key: K, value: ReturnType<typeof freshValues>[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const changeQty = (id: FurnitureId, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_PER_TYPE, q[id] + delta)) }));

  const itemsError =
    estimate.totalItems === 0 ? 'Pick at least one item'
    : qty.Other > 0 && !otherText.trim() ? 'Describe the "Something Else" item'
    : null;

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsError) {
      setError(itemsError);
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id, organization_id')
        .eq('is_active', true)
        .maybeSingle();

      if (!businessInfo) throw new Error('Business information not found');

      const notes = [`Items: ${estimate.breakdown}`, values.notes.trim()].filter(Boolean).join('\n\n');
      const quotedPrice = `$${estimate.price}`;
      const estimatedTime = `${estimate.hours} hours`;

      // The same two rows the public form saves, flagged as a test.
      const inquiry = await createInquiry({
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        client_name: values.name.trim(),
        client_email: values.email.trim(),
        client_phone: values.phone.trim() || undefined,
        furniture_type: estimate.primaryType,
        pieces: estimate.totalItems,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes,
        estimated_price: quotedPrice,
        estimated_time: estimatedTime,
        referral_source: 'contact_form',
        client_type: values.clientType,
        is_test: true,
      });

      const savedRequest = await createSavedRequest({
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        inquiry_id: inquiry.id,
        client_name: values.name.trim(),
        client_email: values.email.trim(),
        client_phone: values.phone.trim() || undefined,
        furniture_type: estimate.primaryType,
        pieces: estimate.totalItems,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes,
        estimated_price: quotedPrice,
        estimated_time: estimatedTime,
        is_test: true,
      });

      // Owner notification only (it carries the TEST banner). Fire and forget,
      // as the public form does: the inquiry is already saved.
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-form-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formType: 'contact',
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          furnitureType: estimate.primaryType,
          pieces: estimate.totalItems,
          preferredDate: values.preferredDate || undefined,
          preferredTimeSlot: values.preferredTimeSlot || undefined,
          notes,
          estimatedPrice: quotedPrice,
          estimatedTime,
          confirmationCode: savedRequest.confirmation_code,
          clientType: values.clientType,
          isTest: true,
          skipCustomerEmail: true,
        }),
      }).catch((err) => console.error('[TestInquiryModal] Email send error:', err));

      setValues(freshValues());
      onSubmitted(inquiry.id);
    } catch (err) {
      console.error('[TestInquiryModal] Test submission failed:', err);
      setError(err instanceof Error ? err.message : 'Test submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/75 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-amber-600" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Submit Test Inquiry</h3>
              <p className="mt-0.5 text-sm text-gray-600">
                Runs the same steps as the website form. Flagged as a test and kept out of every metric.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-600 hover:bg-amber-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="test-name" className={labelCls}>Name</label>
                <input id="test-name" className={inputCls} value={values.name} required disabled={isSubmitting}
                  onChange={(e) => setValue('name', e.target.value)} />
              </div>
              <div>
                <label htmlFor="test-email" className={labelCls}>Email</label>
                <input id="test-email" type="email" className={inputCls} value={values.email} required disabled={isSubmitting}
                  onChange={(e) => setValue('email', e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">The customer is never emailed.</p>
              </div>
              <div>
                <label htmlFor="test-phone" className={labelCls}>Phone</label>
                <input id="test-phone" className={inputCls} value={values.phone} disabled={isSubmitting}
                  onChange={(e) => setValue('phone', e.target.value)} />
              </div>
              <div>
                <label htmlFor="test-client-type" className={labelCls}>Customer type</label>
                <select id="test-client-type" className={inputCls} value={values.clientType} disabled={isSubmitting}
                  onChange={(e) => setValue('clientType', e.target.value as 'residential' | 'business')}>
                  <option value="residential">Residential</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            <div>
              <span className={labelCls}>What needs assembling</span>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {FURNITURE.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{f.label}</p>
                      <p className="text-xs text-gray-500">${f.price} each · {f.minutes} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => changeQty(f.id, -1)} disabled={isSubmitting || qty[f.id] === 0}
                        className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        aria-label={`Fewer ${f.label}`}>
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty[f.id]}</span>
                      <button type="button" onClick={() => changeQty(f.id, 1)} disabled={isSubmitting || qty[f.id] >= MAX_PER_TYPE}
                        className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        aria-label={`More ${f.label}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {qty.Other > 0 && (
                <input className={`${inputCls} mt-2`} placeholder="What is the “Something Else” item?" value={otherText}
                  disabled={isSubmitting} onChange={(e) => setOtherText(e.target.value)} />
              )}
              <p className="mt-2 text-sm text-gray-600">
                {estimate.totalItems > 0
                  ? <>Quote: <span className="font-semibold">${estimate.price}</span> · about {estimate.hours} hrs on site</>
                  : 'Pick at least one item'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="test-date" className={labelCls}>Preferred date</label>
                <input id="test-date" type="date" className={inputCls} value={values.preferredDate} disabled={isSubmitting}
                  onChange={(e) => setValue('preferredDate', e.target.value)} />
              </div>
              <div>
                <label htmlFor="test-time" className={labelCls}>Preferred time</label>
                <select id="test-time" className={inputCls} value={values.preferredTimeSlot} disabled={isSubmitting}
                  onChange={(e) => setValue('preferredTimeSlot', e.target.value)}>
                  <option value="">No preference</option>
                  <option value="morning">Morning (9 AM – 12 PM)</option>
                  <option value="afternoon">Afternoon (12 – 5 PM)</option>
                  <option value="evening">Evening (5 – 8 PM)</option>
                  <option value="weekend">Weekend preferred</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="test-notes" className={labelCls}>Notes</label>
              <textarea id="test-notes" rows={3} className={`${inputCls} resize-none`} value={values.notes}
                disabled={isSubmitting} onChange={(e) => setValue('notes', e.target.value)} />
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p>Saves the inquiry and the customer's saved request, then creates a test job and draft estimate.</p>
              <p>You get the owner email with a TEST banner. Remove everything later with “Delete all test inquiries”.</p>
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button type="button" onClick={handleClose} disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !!itemsError}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              Submit Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
