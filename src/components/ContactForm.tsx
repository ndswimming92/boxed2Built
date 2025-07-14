import React, { useState, useEffect, useRef } from 'react';
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
  const [isIOS, setIsIOS] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect iOS
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
  }, []);

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

  // iOS-specific fixes
  useEffect(() => {
    if (!isIOS) return;

    // Prevent iOS Safari from refreshing on autofill
    const preventRefresh = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    };

    // Handle iOS autofill events
    const handleAutofill = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Delay to allow autofill to complete
      setTimeout(() => {
        if (formRef.current) {
          const formData = new FormData(formRef.current);
          const updatedFields = { ...fields };
          
          // Update state with autofilled values
          Object.keys(initialFields).forEach(key => {
            const value = formData.get(key) as string || '';
            if (value && value !== fields[key as keyof typeof fields].value) {
              updatedFields[key as keyof typeof fields] = {
                ...updatedFields[key as keyof typeof fields],
                value: value
              };
            }
          });
          
          setFields(updatedFields);
        }
      }, 100);
    };

    // Prevent page navigation on iOS
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    // Handle page show (back/forward cache)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page restored from cache, ensure form is in correct state
        setIsSubmitting(false);
        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current);
        }
      }
    };

    // Handle visibility change (iOS Safari specific)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsSubmitting(false);
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add form-specific listeners for iOS
    if (formRef.current) {
      const form = formRef.current;
      
      // Prevent default form submission on iOS
      form.addEventListener('submit', preventRefresh, true);
      
      // Handle autofill events
      form.addEventListener('input', handleAutofill, true);
      form.addEventListener('change', handleAutofill, true);
      
      // Prevent iOS from navigating away
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('blur', handleAutofill);
        input.addEventListener('input', handleAutofill);
      });
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (formRef.current) {
        const form = formRef.current;
        form.removeEventListener('submit', preventRefresh, true);
        form.removeEventListener('input', handleAutofill, true);
        form.removeEventListener('change', handleAutofill, true);
        
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          input.removeEventListener('blur', handleAutofill);
          input.removeEventListener('input', handleAutofill);
        });
      }
      
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, [isIOS, fields, isSubmitting]);

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

  // iOS-safe input handler
  const handleInputChange = (field: keyof typeof fields, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    // Don't prevent default on iOS to allow autofill to work
    if (!isIOS) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const value = e.target.value;
    handleChange(field, value);
  };

  const isFormValid = () => Object.entries(fields).every(
    ([key, { value }]) => !validators[key as keyof typeof fields](value)
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double submission
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Clear any existing timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    // Set a timeout to reset submission state (iOS safety)
    submitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
    }, 10000);

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
        // Create a new FormData object to ensure clean submission
        const formData = new FormData();
        formData.append('name', fields.name.value);
        formData.append('email', fields.email.value);
        formData.append('phone', fields.phone.value);
        formData.append('furnitureType', fields.furnitureType.value);
        formData.append('pieces', fields.pieces.value);
        formData.append('preferredTime', fields.preferredTime.value);
        formData.append('notes', fields.notes.value);
        formData.append('user_city', userCity);

        // Submit using fetch for better iOS compatibility
        const response = await fetch('https://formspree.io/f/mwpqepva', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          // Manually trigger success state
          setFields(initialFields);
          // Use a small delay to ensure state updates
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          throw new Error('Form submission failed');
        }
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current);
        }
        setIsSubmitting(false);
      }
    } else {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
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
      <form 
        ref={formRef}
        onSubmit={onSubmit} 
        noValidate 
        autoComplete="on"
        // iOS-specific attributes
        data-turbo="false"
        data-remote="false"
      >
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
              // iOS-specific attributes
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck="false"
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
              // iOS-specific attributes
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
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
                  // iOS-specific attributes
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
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
              // iOS-specific attributes
              inputMode="numeric"
              pattern="[0-9]*"
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
              // iOS-specific attributes
              autoCapitalize="none"
              autoCorrect="on"
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
              // iOS-specific attributes
              autoCapitalize="sentences"
              autoCorrect="on"
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
            // iOS-specific attributes
            data-turbo="false"
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