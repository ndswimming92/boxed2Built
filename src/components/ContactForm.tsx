import React, { useState } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface FieldState {
  value: string;
  error: string;
  touched: boolean;
}

const initialFields = {
  name: { value: '', error: '', touched: false },
  email: { value: '', error: '', touched: false },
  phone: { value: '', error: '', touched: false },
  furnitureType: { value: '', error: '', touched: false },
  pieces: { value: '', error: '', touched: false },
  preferredTime: { value: '', error: '', touched: false },
  notes: { value: '', error: '', touched: false },
};

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mwpqepva");
  const [fields, setFields] = useState(initialFields);

  if (state.succeeded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You!</h3>
        <p className="text-green-700">We’ll get back to you shortly with a quote.</p>
      </div>
    );
  }

  const validators = {
    name: (v: string) => !v.trim() ? 'Name is required' : v.trim().length < 2 ? 'Name must be at least 2 characters' : '',
    email: (v: string) => !v.trim() ? 'Email is required' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email' : '',
    phone: (v: string) => {
      const digits = v.replace(/\D/g, '');
      return digits.length > 0 && digits.length < 10 ? 'Incomplete phone number' : '';
    },
    furnitureType: (v: string) => !v ? 'Please select a furniture type' : '',
    pieces: (v: string) => {
      const n = parseInt(v, 10);
      if (!v) return 'Number of pieces is required';
      if (isNaN(n) || n < 1) return 'At least 1 piece';
      if (n > 5) return 'For more than 5, please call';
      return '';
    },
    preferredTime: () => '',
    notes: () => '',
  };

  const handleChange = (field: keyof typeof fields, value: string) => {
    const error = fields[field].touched ? validators[field](value) : '';
    setFields(prev => ({
      ...prev,
      [field]: { ...prev[field], value, error }
    }));
  };

  const handleBlur = (field: keyof typeof fields) => {
    const error = validators[field](fields[field].value);
    setFields(prev => ({
      ...prev,
      [field]: { ...prev[field], touched: true, error }
    }));
  };

  const isFormValid = () => Object.entries(fields).every(
    ([key, { value }]) => !validators[key as keyof typeof fields](value)
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated = { ...fields };
    let valid = true;

    (Object.keys(fields) as (keyof typeof fields)[]).forEach(key => {
      const err = validators[key](fields[key].value);
      if (err) valid = false;
      updated[key] = { ...fields[key], touched: true, error: err };
    });

    setFields(updated);

    if (valid) {
      trackEvent('contact-form-submit');
      handleSubmit(e);
    }
  };

  const inputClass = (field: keyof typeof fields) =>
    `w-full px-3 py-2 border rounded focus:outline-none ${
      !fields[field].touched
        ? 'border-gray-300'
        : fields[field].error
        ? 'border-red-400 bg-red-50'
        : 'border-green-400 bg-green-50'
    }`;

  return (
    <div className="bg-white rounded shadow p-6">
      <h3 className="text-xl font-bold mb-4">Get Your Free Quote</h3>
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              name="name"
              value={fields.name.value}
              onChange={e => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              className={inputClass('name')}
              aria-invalid={!!fields.name.error}
            />
            {fields.name.touched && fields.name.error && (
              <p className="text-red-600 text-sm">{fields.name.error}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              name="email"
              value={fields.email.value}
              onChange={e => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              className={inputClass('email')}
              aria-invalid={!!fields.email.error}
            />
            {fields.email.touched && fields.email.error && (
              <p className="text-red-600 text-sm">{fields.email.error}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone">Phone (optional)</label>
            <InputMask
              id="phone"
              name="phone"
              mask="(999) 999-9999"
              value={fields.phone.value}
              onChange={e => handleChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
            >
              {(inputProps: any) => (
                <input
                  {...inputProps}
                  className={inputClass('phone')}
                  aria-invalid={!!fields.phone.error}
                  placeholder="(555) 123-4567"
                />
              )}
            </InputMask>
            {fields.phone.touched && fields.phone.error && (
              <p className="text-red-600 text-sm">{fields.phone.error}</p>
            )}
          </div>

          {/* Furniture Type */}
          <div>
            <label htmlFor="furnitureType">Furniture Type *</label>
            <select
              id="furnitureType"
              name="furnitureType"
              value={fields.furnitureType.value}
              onChange={e => handleChange('furnitureType', e.target.value)}
              onBlur={() => handleBlur('furnitureType')}
              className={inputClass('furnitureType')}
            >
              <option value="">-- Please choose --</option>
              <option value="Bed">Bed</option>
              <option value="Dresser">Dresser</option>
              <option value="Table">Table</option>
              <option value="Chair">Chair</option>
              <option value="Bookshelf">Bookshelf</option>
              <option value="IKEA">IKEA Furniture</option>
              <option value="Multiple">Multiple Items</option>
              <option value="Other">Other</option>
            </select>
            {fields.furnitureType.touched && fields.furnitureType.error && (
              <p className="text-red-600 text-sm">{fields.furnitureType.error}</p>
            )}
          </div>

          {/* Pieces */}
          <div>
            <label htmlFor="pieces">Number of Pieces *</label>
            <input
              id="pieces"
              type="number"
              name="pieces"
              min="1"
              value={fields.pieces.value}
              onChange={e => handleChange('pieces', e.target.value)}
              onBlur={() => handleBlur('pieces')}
              className={inputClass('pieces')}
            />
            {fields.pieces.touched && fields.pieces.error && (
              <p className="text-red-600 text-sm">{fields.pieces.error}</p>
            )}
          </div>

          {/* Preferred Time */}
          <div>
            <label htmlFor="preferredTime">Preferred Date & Time</label>
            <input
              id="preferredTime"
              name="preferredTime"
              value={fields.preferredTime.value}
              onChange={e => handleChange('preferredTime', e.target.value)}
              onBlur={() => handleBlur('preferredTime')}
              className={inputClass('preferredTime')}
              placeholder="e.g., Saturday afternoon"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes">Additional Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={fields.notes.value}
              onChange={e => handleChange('notes', e.target.value)}
              onBlur={() => handleBlur('notes')}
              className={inputClass('notes')}
              placeholder="Any extra details"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={state.submitting || !isFormValid()}
            className={`w-full py-3 px-4 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition ${
              state.submitting || !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-busy={state.submitting}
          >
            {state.submitting ? 'Submitting…' : (
              <span className="flex items-center justify-center gap-2">
                <Send size={16} /> Get Free Quote
              </span>
            )}
          </button>

          {state.errors && state.errors.length > 0 && (
            <div className="mt-4 bg-red-100 text-red-700 p-2 rounded flex items-center">
              <AlertCircle size={16} className="mr-1" /> Please fix the errors above.
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2 text-center">
            By submitting, you agree to our <a href="/terms-of-service" className="underline">Terms of Service</a>.
          </p>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;
