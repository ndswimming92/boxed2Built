import React, { useState, useEffect } from 'react';
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
  const [userCity, setUserCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user's city on component mount
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.city && data.region) {
          setUserCity(`${data.city}, ${data.region}`);
        } else if (data.city) {
          setUserCity(data.city);
        }
      } catch (error) {
        console.log('Could not fetch location:', error);
        setUserCity('Location not detected');
      }
    };

    fetchUserLocation();
  }, []);

  // iOS Safari autofill fix - prevent page refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was restored from cache, reset form state if needed
        window.location.reload();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isSubmitting]);

  if (state.succeeded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You!</h3>
        <p className="text-green-700">We'll get back to you shortly with a quote.</p>
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

  // iOS-specific input handler to prevent autofill issues
  const handleInputChange = (field: keyof typeof fields, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const value = e.target.value;
    handleChange(field, value);
  };

  const isFormValid = () => Object.entries(fields).every(
    ([key, { value }]) => !validators[key as keyof typeof fields](value)
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsSubmitting(true);

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
      
      try {
        await handleSubmit(e);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field: keyof typeof fields) =>
    `w-full px-3 py-2 border rounded focus:outline-none transition-colors ${
      !fields[field].touched
        ? 'border-gray-300 focus:border-blue-500'
        : fields[field].error
        ? 'border-red-400 bg-red-50 focus:border-red-500'
        : 'border-green-400 bg-green-50 focus:border-green-500'
    }`;

  return (
    <div className="bg-white rounded shadow p-6">
      <h3 className="text-xl font-bold mb-4">Get Your Free Quote</h3>
      <form onSubmit={onSubmit} noValidate autoComplete="on">
        <div className="space-y-4">
          {/* Hidden field for user location */}
          <input
            type="hidden"
            name="user_city"
            value={userCity}
          />

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={fields.name.value}
              onChange={(e) => handleInputChange('name', e)}
              onBlur={() => handleBlur('name')}
              className={inputClass('name')}
              aria-invalid={!!fields.name.error}
              data-lpignore="true"
            />
            {fields.name.touched && fields.name.error && (
              <p className="text-red-600 text-sm mt-1">{fields.name.error}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              value={fields.email.value}
              onChange={(e) => handleInputChange('email', e)}
              onBlur={() => handleBlur('email')}
              className={inputClass('email')}
              aria-invalid={!!fields.email.error}
              data-lpignore="true"
            />
            {fields.email.touched && fields.email.error && (
              <p className="text-red-600 text-sm mt-1">{fields.email.error}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <InputMask
              id="phone"
              name="phone"
              mask="(999) 999-9999"
              value={fields.phone.value}
              onChange={(e) => handleInputChange('phone', e)}
              onBlur={() => handleBlur('phone')}
            >
              {(inputProps: any) => (
                <input
                  {...inputProps}
                  autoComplete="tel"
                  className={inputClass('phone')}
                  aria-invalid={!!fields.phone.error}
                  placeholder="(555) 123-4567"
                  data-lpignore="true"
                />
              )}
            </InputMask>
            {fields.phone.touched && fields.phone.error && (
              <p className="text-red-600 text-sm mt-1">{fields.phone.error}</p>
            )}
          </div>

          {/* Furniture Type */}
          <div>
            <label htmlFor="furnitureType" className="block text-sm font-medium text-gray-700 mb-1">Furniture Type *</label>
            <select
              id="furnitureType"
              name="furnitureType"
              value={fields.furnitureType.value}
              onChange={(e) => handleInputChange('furnitureType', e)}
              onBlur={() => handleBlur('furnitureType')}
              className={inputClass('furnitureType')}
              data-lpignore="true"
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
              <p className="text-red-600 text-sm mt-1">{fields.furnitureType.error}</p>
            )}
          </div>

          {/* Pieces */}
          <div>
            <label htmlFor="pieces" className="block text-sm font-medium text-gray-700 mb-1">Number of Pieces *</label>
            <input
              id="pieces"
              type="number"
              name="pieces"
              min="1"
              max="5"
              value={fields.pieces.value}
              onChange={(e) => handleInputChange('pieces', e)}
              onBlur={() => handleBlur('pieces')}
              className={inputClass('pieces')}
              data-lpignore="true"
            />
            {fields.pieces.touched && fields.pieces.error && (
              <p className="text-red-600 text-sm mt-1">{fields.pieces.error}</p>
            )}
          </div>

          {/* Preferred Time */}
          <div>
            <label htmlFor="preferredTime" className="block text-sm font-medium text-gray-700 mb-1">Preferred Date & Time</label>
            <input
              id="preferredTime"
              name="preferredTime"
              type="text"
              value={fields.preferredTime.value}
              onChange={(e) => handleInputChange('preferredTime', e)}
              onBlur={() => handleBlur('preferredTime')}
              className={inputClass('preferredTime')}
              placeholder="e.g., Saturday afternoon"
              data-lpignore="true"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={fields.notes.value}
              onChange={(e) => handleInputChange('notes', e)}
              onBlur={() => handleBlur('notes')}
              className={inputClass('notes')}
              placeholder="Any extra details"
              data-lpignore="true"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={state.submitting || isSubmitting || !isFormValid()}
            className={`w-full py-3 px-4 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition ${
              state.submitting || isSubmitting || !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-busy={state.submitting || isSubmitting}
          >
            {state.submitting || isSubmitting ? 'Submitting…' : (
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
            {userCity && <span className="block mt-1">Detected location: {userCity}</span>}
          </p>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;