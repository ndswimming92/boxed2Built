import React, { useState, useEffect, useRef } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp, MapPin, Clock } from 'lucide-react';
import { trackEvent, trackFormInteraction, trackConversion } from '../utils/analytics';

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
  preferredDate: { value: '', error: '', touched: false },
  preferredTimeSlot: { value: '', error: '', touched: false },
  notes: { value: '', error: '', touched: false },
};

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mwpqepva");
  const [fields, setFields] = useState(initialFields);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
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

  // Smart estimation based on furniture type and pieces
  useEffect(() => {
    const furnitureType = fields.furnitureType.value;
    const pieces = parseInt(fields.pieces.value) || 0;
    
    if (furnitureType && pieces > 0) {
      let baseTime = 0;
      let basePrice = 0;
      
      switch (furnitureType) {
        case 'Chair':
          baseTime = 30;
          basePrice = 45;
          break;
        case 'Table':
          baseTime = 60;
          basePrice = 96;
          break;
        case 'Bookshelf':
          baseTime = 90;
          basePrice = 116;
          break;
        case 'Dresser':
          baseTime = 120;
          basePrice = 166;
          break;
        case 'Bed':
          baseTime = 90;
          basePrice = 153;
          break;
        case 'IKEA':
          baseTime = 75;
          basePrice = 96;
          break;
        case 'Multiple':
          baseTime = 45;
          basePrice = 45;
          break;
        default:
          baseTime = 60;
          basePrice = 96;
      }
      
      const totalTime = baseTime * pieces;
      const totalPrice = basePrice * pieces;
      
      // Apply volume discount for multiple pieces
      const discountedPrice = pieces > 3 ? totalPrice * 0.9 : totalPrice;
      
      setEstimatedTime(`${Math.round(totalTime / 60 * 10) / 10} hours`);
      setEstimatedPrice(`$${Math.round(discountedPrice)}`);
    } else {
      setEstimatedTime('');
      setEstimatedPrice('');
    }
  }, [fields.furnitureType.value, fields.pieces.value]);

  // iOS-specific fixes
  useEffect(() => {
    if (!isIOS) return;

    // Handle iOS autofill events without interfering with form submission
    const handleAutofill = (e: Event) => {
      // Don't prevent default - let iOS autofill work naturally
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

    // Handle page show (back/forward cache)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsSubmitting(false);
        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current);
        }
      }
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden && isSubmitting) {
        setIsSubmitting(false);
      }
    };

    // Add event listeners
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add form-specific listeners for iOS autofill
    if (formRef.current) {
      const form = formRef.current;
      form.addEventListener('input', handleAutofill, { passive: true });
      form.addEventListener('change', handleAutofill, { passive: true });
    }

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (formRef.current) {
        const form = formRef.current;
        form.removeEventListener('input', handleAutofill);
        form.removeEventListener('change', handleAutofill);
      }
      
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, [isIOS, fields, isSubmitting]);

  // Handle successful submission
  useEffect(() => {
    if (state.succeeded) {
      setFields(initialFields);
      setIsSubmitting(false);
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    }
  }, [state.succeeded]);

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
    email: (v: string) => {
      if (!v.trim()) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(v)) return 'Please enter a valid email address (e.g., john@example.com)';
      if (!v.includes('@')) return 'Email must contain @ symbol';
      if (!v.includes('.')) return 'Email must contain a domain (e.g., .com)';
      return '';
    },
    phone: (v: string) => {
      const digits = v.replace(/\D/g, '');
      return digits.length > 0 && digits.length < 10 ? 'Incomplete phone number' : '';
    },
    furnitureType: (v: string) => !v ? 'Please select a furniture type' : '',
    pieces: (v: string) => {
      const n = parseInt(v, 10);
      if (!v) return 'Number of pieces is required';
      if (isNaN(n) || n < 1) return 'Must be at least 1 piece';
      return '';
    },
    notes: (v: string) => {
      // Only require notes if "Other" is selected for furniture type
      if (fields.furnitureType.value === 'Other' && !v.trim()) {
        return 'Please specify the furniture type';
      }
      return '';
    },
    preferredDate: () => '',
    preferredTimeSlot: () => '',
  };

  const handleChange = (field: keyof typeof fields, value: string) => {
    const error = fields[field].touched ? validators[field](value) : '';
    setFields(prev => ({
      ...prev,
      [field]: { ...prev[field], value, error }
    }));
    
    // Track form field interactions
    if (!fields[field].touched && value.length > 0) {
      trackFormInteraction('contact_form', 'start', field);
    }
  };

  const handleBlur = (field: keyof typeof fields) => {
    const error = validators[field](fields[field].value);
    setFields(prev => ({
      ...prev,
      [field]: { ...prev[field], touched: true, error }
    }));
  };

  const handleInputChange = (field: keyof typeof fields, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    handleChange(field, value);
  };

  const isFormValid = () => {
    const requiredFields = ['name', 'email', 'furnitureType', 'pieces'];
    
    // Add notes as required if "Other" is selected
    if (fields.furnitureType.value === 'Other') {
      requiredFields.push('notes');
    }
    
    return requiredFields.every(field => {
      const fieldKey = field as keyof typeof fields;
      const value = fields[fieldKey].value;
      const error = validators[fieldKey](value);
      return !error && value.trim() !== '';
    });
  };

  const toggleOptionalFields = () => {
    setShowOptionalFields(!showOptionalFields);
    trackEvent('form-optional-fields-toggle', showOptionalFields ? 'hide' : 'show');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting || state.submitting) return;

    setIsSubmitting(true);

    // Clear any existing timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    // Set a timeout to reset submission state
    submitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
    }, 10000);

    // Validate all fields
    const updated = { ...fields };
    let valid = true;

    (Object.keys(fields) as (keyof typeof fields)[]).forEach(key => {
      const err = validators[key](fields[key].value);
      if (err) valid = false;
      updated[key] = { ...fields[key], touched: true, error: err };
    });

    setFields(updated);

    if (valid) {
      trackFormInteraction('contact_form', 'complete');
      trackConversion('form_submission', 1);
      trackEvent('contact-form-submit', 'contact_form', {
        event_category: 'conversion',
        value: 1,
        user_engagement: 'form_submission'
      });
      
      try {
        // Create form data for submission
        const formData = new FormData();
        formData.append('name', fields.name.value);
        formData.append('email', fields.email.value);
        formData.append('phone', fields.phone.value);
        formData.append('furnitureType', fields.furnitureType.value);
        formData.append('pieces', fields.pieces.value);
        formData.append('preferredDate', fields.preferredDate.value);
        formData.append('preferredTimeSlot', fields.preferredTimeSlot.value);
        formData.append('notes', fields.notes.value);
        formData.append('user_city', userCity);

        // Use Formspree's handleSubmit function
        await handleSubmit(formData);
        
      } catch (error) {
        console.error('Form submission error:', error);
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }

    // Clear timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
  };

  const inputClass = (field: keyof typeof fields) =>
    `w-full px-3 py-2 border rounded focus:outline-none transition-colors ${
      !fields[field].touched
        ? 'border-gray-400 focus:border-blue-700'
        : fields[field].error
        ? 'border-red-600 bg-red-50 focus:border-red-700'
        : 'border-green-600 bg-green-50 focus:border-green-700'
    }`;

  return (
    <div className="bg-white rounded shadow p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2">Get Your Free Quote</h3>
        <p className="text-sm text-gray-600">Just a few details to get started - takes less than 2 minutes</p>
        {userCity && (
          <div className="flex items-center mt-2 text-sm text-blue-700">
            <MapPin size={14} className="mr-1" />
            <span>Service available in {userCity}</span>
          </div>
        )}
      </div>

      <form 
        ref={formRef}
        onSubmit={onSubmit} 
        noValidate 
        autoComplete="on"
      >
        <div className="space-y-5">
          {/* Hidden field for user location */}
          <input
            type="hidden"
            name="user_city"
            value={userCity}
          />

          {/* Essential Information Group */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
              Contact Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Smith"
                  value={fields.name.value}
                  onChange={(e) => handleInputChange('name', e)}
                  onBlur={() => handleBlur('name')}
                  className={inputClass('name')}
                  aria-invalid={!!fields.name.error}
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {fields.name.touched && fields.name.error && (
                  <p className="text-red-700 text-sm mt-1">{fields.name.error}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="john@example.com"
                  value={fields.email.value}
                  onChange={(e) => handleInputChange('email', e)}
                  onBlur={() => handleBlur('email')}
                  className={inputClass('email')}
                  aria-invalid={!!fields.email.error}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {fields.email.touched && fields.email.error && (
                  <p className="text-red-700 text-sm mt-1">{fields.email.error}</p>
                )}
              </div>
            </div>

            {/* Phone - Optional but prominent */}
            <div className="mt-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-gray-500 text-xs">(optional - for faster response)</span>
              </label>
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
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                )}
              </InputMask>
              {fields.phone.touched && fields.phone.error && (
                <p className="text-red-700 text-sm mt-1">{fields.phone.error}</p>
              )}
            </div>
          </div>

          {/* Project Details Group */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
              <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
              Project Details
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Furniture Type */}
              <div>
                <label htmlFor="furnitureType" className="block text-sm font-medium text-gray-700 mb-1">What needs assembly? *</label>
                <select
                  id="furnitureType"
                  name="furnitureType"
                  value={fields.furnitureType.value}
                  onChange={(e) => handleInputChange('furnitureType', e)}
                  onBlur={() => handleBlur('furnitureType')}
                  className={inputClass('furnitureType')}
                >
                  <option value="">Select furniture type</option>
                  <option value="Chair">Dining Chairs</option>
                  <option value="Table">Tables & Desks</option>
                  <option value="Bed">Bed Frames</option>
                  <option value="Dresser">Dressers & Storage</option>
                  <option value="Bookshelf">Bookshelves & Media Units</option>
                  <option value="IKEA">IKEA Furniture</option>
                  <option value="Other">Other (please specify in notes)</option>
                </select>
                {fields.furnitureType.touched && fields.furnitureType.error && (
                  <p className="text-red-700 text-sm mt-1">{fields.furnitureType.error}</p>
                )}
              </div>

              {/* Conditional Notes Field for "Other" Selection */}
              {fields.furnitureType.value === 'Other' && (
                <div className="md:col-span-2">
                  <label htmlFor="otherFurnitureDetails" className="block text-sm font-medium text-gray-700 mb-1">
                    Please specify the furniture type *
                  </label>
                  <textarea
                    id="otherFurnitureDetails"
                    name="otherFurnitureDetails"
                    rows={2}
                    value={fields.notes.value}
                    onChange={(e) => handleInputChange('notes', e)}
                    onBlur={() => handleBlur('notes')}
                    className={inputClass('notes')}
                    placeholder="Please describe the furniture you need assembled (e.g., outdoor furniture, exercise equipment, etc.)"
                    required
                    autoCapitalize="sentences"
                    autoCorrect="on"
                  />
                  {fields.notes.touched && fields.notes.error && (
                    <p className="text-red-700 text-sm mt-1">{fields.notes.error}</p>
                  )}
                </div>
              )}
              {/* Pieces */}
              <div>
                <label htmlFor="pieces" className="block text-sm font-medium text-gray-700 mb-1">How many pieces? *</label>
                <input
                  id="pieces"
                  type="number"
                  name="pieces"
                  min="1"
                  max="20"
                  value={fields.pieces.value}
                  onChange={(e) => handleInputChange('pieces', e)}
                  onBlur={() => handleBlur('pieces')}
                  className={inputClass('pieces')}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                />
                {fields.pieces.touched && fields.pieces.error && (
                  <p className="text-red-700 text-sm mt-1">{fields.pieces.error}</p>
                )}
              </div>
            </div>

            {/* Smart Estimation Display */}
            {estimatedTime && estimatedPrice && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-green-300">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-green-700">
                    <Clock size={16} className="mr-2" />
                    <span>Estimated time: <strong>{estimatedTime}</strong></span>
                  </div>
                  <div className="text-green-700">
                    <span>Estimated cost: <strong>{estimatedPrice}</strong></span>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {parseInt(fields.pieces.value) > 3 && "Volume discount applied! "}
                  Final quote provided after consultation.
                </p>
              </div>
            )}
          </div>

          {/* Progressive Disclosure for Optional Fields */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={toggleOptionalFields}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <span>Scheduling Preferences (optional)</span>
              {showOptionalFields ? (
                <ChevronUp size={16} className="text-gray-500" />
              ) : (
                <ChevronDown size={16} className="text-gray-500" />
              )}
            </button>
            
            {showOptionalFields && (
              <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
                {/* Preferred Date */}
                <div>
                  <label htmlFor="preferredDate" className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                  <input
                    id="preferredDate"
                    name="preferredDate"
                    type="date"
                    value={fields.preferredDate.value}
                    onChange={(e) => handleInputChange('preferredDate', e)}
                    onBlur={() => handleBlur('preferredDate')}
                    className={inputClass('preferredDate')}
                    min={new Date().toISOString().split('T')[0]}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  {fields.preferredDate.touched && fields.preferredDate.error && (
                    <p className="text-red-700 text-sm mt-1">{fields.preferredDate.error}</p>
                  )}
                </div>

                {/* Preferred Time Slot */}
                <div>
                  <label htmlFor="preferredTimeSlot" className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
                  <select
                    id="preferredTimeSlot"
                    name="preferredTimeSlot"
                    value={fields.preferredTimeSlot.value}
                    onChange={(e) => handleInputChange('preferredTimeSlot', e)}
                    onBlur={() => handleBlur('preferredTimeSlot')}
                    className={inputClass('preferredTimeSlot')}
                  >
                    <option value="">No preference</option>
                    <option value="morning">Morning (9 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 8 PM)</option>
                    <option value="weekend">Weekend preferred</option>
                  </select>
                  {fields.preferredTimeSlot.touched && fields.preferredTimeSlot.error && (
                    <p className="text-red-700 text-sm mt-1">{fields.preferredTimeSlot.error}</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Additional Details</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={fields.notes.value}
                    onChange={(e) => handleInputChange('notes', e)}
                    onBlur={() => handleBlur('notes')}
                    className={inputClass('notes')}
                    placeholder="Any special requirements, access instructions, or questions..."
                    autoCapitalize="sentences"
                    autoCorrect="on"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={state.submitting || isSubmitting || !isFormValid()}
            className={`w-full py-4 px-6 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-all duration-200 shadow-md hover:shadow-lg ${
              state.submitting || isSubmitting || !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-busy={state.submitting || isSubmitting}
          >
            {state.submitting || isSubmitting ? 'Submitting…' : (
              <span className="flex items-center justify-center gap-2">
                <Send size={18} /> Get My Free Quote
              </span>
            )}
          </button>

          {state.errors && state.errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start">
              <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" /> 
              <div>
                <p className="font-medium">Please check the following:</p>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {state.errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-600">
              By submitting, you agree to our <a href="/terms-of-service" className="text-blue-700 hover:text-blue-800 underline">Terms of Service</a>
            </p>
            <p className="text-xs text-green-700 mt-1 font-medium">
              ✓ Free consultation ✓ Weekend service available ✓ No commitment required
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;