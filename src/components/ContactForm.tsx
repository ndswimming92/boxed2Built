import React, { useState, useEffect, useRef } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp, MapPin, Clock, Loader2, Lock } from 'lucide-react';
import { trackEvent, trackFormInteraction, trackConversion } from '../utils/analytics';
import FormField from './ui/FormField';
import ValidationMessage from './ui/ValidationMessage';
import ProgressBar from './ui/ProgressBar';
import { useFormValidation, ValidationRule } from '../hooks/useFormValidation';
import { supabase } from '../lib/supabase';
import { createInquiry } from '../services/inquiryService';
import { createSavedRequest } from '../services/savedRequestService';
import ConfirmationModal from './ConfirmationModal';

const initialValues = {
  name: { value: '', error: '', touched: false },
  email: { value: '', error: '', touched: false },
  phone: { value: '', error: '', touched: false },
  furnitureType: { value: '', error: '', touched: false },
  pieces: { value: '', error: '', touched: false },
  preferredDate: { value: '', error: '', touched: false },
  preferredTimeSlot: { value: '', error: '', touched: false },
  notes: { value: '', error: '', touched: false },
};

// Enhanced validation rules
const validationRules: Record<string, ValidationRule> = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    custom: (value) => {
      if (value.trim().split(' ').length < 1) {
        return 'Please enter your full name';
      }
      if (value.trim().length < 2) {
        return 'Name must be at least 2 characters';
      }
      return null;
    },
    validateOnChange: true
  },
  email: {
    required: true,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    custom: (value) => {
      if (!value.includes('@')) return 'Email must contain @ symbol';
      if (!value.includes('.')) return 'Email must contain a domain (e.g., .com)';
      if (value.includes('..')) return 'Invalid email format';
      if (value.startsWith('.') || value.endsWith('.')) return 'Invalid email format';
      if (value.split('@').length !== 2) return 'Email must contain exactly one @ symbol';
      const [localPart, domain] = value.split('@');
      if (localPart.length === 0) return 'Email must have text before @ symbol';
      if (domain.length === 0) return 'Email must have a domain after @ symbol';
      if (!domain.includes('.')) return 'Email domain must contain a dot (e.g., .com)';
      return null;
    },
    validateOnChange: true
  },
  phone: {
    required: false,
    custom: (value) => {
      if (!value) return null;
      const digits = value.replace(/\D/g, '');
      if (digits.length > 0 && digits.length < 10) {
        return 'Please enter a complete phone number';
      }
      if (digits.length > 11) {
        return 'Phone number is too long';
      }
      return null;
    }
  },
  furnitureType: {
    required: true,
    custom: (value) => {
      const validTypes = ['Chair', 'Table', 'Bed', 'Dresser', 'Bookshelf', 'IKEA', 'Other'];
      if (!validTypes.includes(value)) {
        return 'Please select a valid furniture type';
      }
      return null;
    }
  },
  pieces: {
    required: true,
    custom: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        return 'Please enter at least 1 piece';
      }
      if (num > 50) {
        return 'For large projects, please contact us directly';
      }
      return null;
    }
  },
  notes: {
    required: false,
    maxLength: 500,
    custom: (value, allValues) => {
      // Only require notes if "Other" is selected for furniture type
      if (allValues?.furnitureType === 'Other' && !value?.trim()) {
        return 'Please specify the furniture type';
      }
      return null;
    }
  },
  preferredDate: {
    required: false
  },
  preferredTimeSlot: {
    required: false
  }
};

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mwpqepva");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [userCity, setUserCity] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [formProgress, setFormProgress] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Use enhanced form validation
  const {
    fields,
    isFormValid,
    hasErrors,
    isValidating,
    isSubmitting,
    submitAttempted,
    handleFieldChange,
    handleFieldBlur,
    handleSubmit: handleValidatedSubmit,
    reset,
    getFieldProps
  } = useFormValidation({
    initialValues: Object.keys(initialValues).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {} as Record<string, string>),
    validationRules,
    validateOnChange: false,
    validateOnBlur: true,
    debounceMs: 300
  });

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
    const furnitureType = fields.furnitureType?.value;
    const pieces = parseInt(fields.pieces?.value) || 0;

    if (furnitureType && pieces > 0) {
      let baseTime = 0;
      let basePrice = 0;

      switch (furnitureType) {
        case 'Chair':
          baseTime = 60;
          basePrice = 85;
          break;
        case 'Table':
          baseTime = 120;
          basePrice = 185;
          break;
        case 'Bookshelf':
          baseTime = 150;
          basePrice = 220;
          break;
        case 'Dresser':
          baseTime = 210;
          basePrice = 320;
          break;
        case 'Bed':
          baseTime = 180;
          basePrice = 295;
          break;
        case 'IKEA':
          baseTime = 120;
          basePrice = 185;
          break;
        case 'Multiple':
          baseTime = 60;
          basePrice = 85;
          break;
        default:
          baseTime = 120;
          basePrice = 185;
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
  }, [fields.furnitureType?.value, fields.pieces?.value]);

  // Calculate form progress based on required fields
  useEffect(() => {
    const isFieldComplete = (fieldName: string) => {
      const field = fields[fieldName];
      return field && field.value && field.value.trim() !== '' && field.valid;
    };

    const requiredFields = ['name', 'email', 'furnitureType', 'pieces'];

    // Add notes as required if furniture type is "Other"
    const isOtherSelected = fields.furnitureType?.value === 'Other';
    if (isOtherSelected) {
      requiredFields.push('notes');
    }

    const completedFields = requiredFields.filter(isFieldComplete).length;
    const totalRequired = requiredFields.length;
    const progress = Math.round((completedFields / totalRequired) * 100);

    setFormProgress(progress);
  }, [
    fields.name?.value,
    fields.name?.valid,
    fields.email?.value,
    fields.email?.valid,
    fields.furnitureType?.value,
    fields.furnitureType?.valid,
    fields.pieces?.value,
    fields.pieces?.valid,
    fields.notes?.value,
    fields.notes?.valid
  ]);


  const toggleOptionalFields = () => {
    setShowOptionalFields(!showOptionalFields);
    trackEvent('form-optional-fields-toggle', 'contact_form', {
      event_category: 'form_interaction',
      action_type: showOptionalFields ? 'hide' : 'show',
      action_value: showOptionalFields ? 'hide' : 'show',
      page_section: 'contact_form',
      element_type: 'button',
      form_name: 'contact_form'
    });
  };

  const onSubmit = handleValidatedSubmit(async (values) => {
    try {
      // Track form completion with detailed parameters
      trackFormInteraction('contact_form', 'complete', {
        page_section: 'contact_form',
        furniture_type: values.furnitureType,
        number_of_pieces: parseInt(values.pieces) || 0,
        estimated_value: estimatedPrice,
        form_step: 'submit'
      });

      // Track conversion with enhanced parameters
      trackConversion('form_submission', 1, 'USD', {
        page_section: 'contact_form',
        conversion_type: 'lead',
        furniture_type: values.furnitureType,
        number_of_pieces: parseInt(values.pieces) || 0
      });

      trackEvent('contact-form-submit', 'contact_form', {
        event_category: 'conversion',
        value: 1,
        user_engagement: 'form_submission',
        element_type: 'form',
        action_type: 'submit',
        furniture_type: values.furnitureType,
        number_of_pieces: parseInt(values.pieces) || 0
      });

      // Create form data for submission to Formspree
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('user_city', userCity);

      // Submit to Formspree (fire and forget - don't block on this)
      handleSubmit(formData).catch((error) => {
        console.error('Formspree submission error:', error);
      });

      // Save to Supabase database for admin tracking and create saved request
      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (!businessInfo) {
        throw new Error('Business information not found');
      }

      const inquiry = await createInquiry({
        business_id: businessInfo.id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        user_city: userCity || undefined,
        estimated_price: estimatedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        referral_source: 'contact_form',
      });

      const savedRequest = await createSavedRequest({
        business_id: businessInfo.id,
        inquiry_id: inquiry.id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        user_city: userCity || undefined,
        estimated_price: estimatedPrice || undefined,
        estimated_time: estimatedTime || undefined,
      });

      // Set confirmation data
      const confirmData = {
        confirmationCode: savedRequest.confirmation_code,
        clientName: values.name,
        clientEmail: values.email,
        clientPhone: values.phone || undefined,
        furnitureType: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferredDate: values.preferredDate || undefined,
        preferredTimeSlot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        userCity: userCity || undefined,
        estimatedPrice: estimatedPrice || undefined,
        estimatedTime: estimatedTime || undefined,
        submissionDate: savedRequest.submission_date,
      };

      console.log('[ContactForm] Setting confirmation data:', confirmData);
      setConfirmationData(confirmData);

      console.log('[ContactForm] Opening modal - setting showConfirmationModal to true');
      setShowConfirmationModal(true);

      // Reset form AFTER showing modal
      console.log('[ContactForm] Resetting form');
      reset();

    } catch (error) {
      console.error('[ContactForm] Error during form submission:', error);

      // Log detailed error information
      if (error instanceof Error) {
        console.error('[ContactForm] Error message:', error.message);
        console.error('[ContactForm] Error stack:', error.stack);
      }

      // Show error message to user
      const errorMessage = error instanceof Error
        ? `Submission failed: ${error.message}`
        : 'An unexpected error occurred. Please try again or contact us directly.';

      setSubmissionError(errorMessage);

      // Clear error after 10 seconds
      setTimeout(() => {
        setSubmissionError(null);
      }, 10000);
    }
  });

  const getInputClasses = (fieldName: string) => {
    const field = fields[fieldName];
    const baseClasses = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200';
    
    if (!field?.touched && !submitAttempted) {
      return `${baseClasses} border-gray-300`;
    }
    
    if (field?.error) {
      return `${baseClasses} border-red-500 bg-red-50`;
    }
    
    if (field?.valid && field?.touched) {
      return `${baseClasses} border-green-500 bg-green-50`;
    }
    
    return `${baseClasses} border-gray-300`;
  };


  console.log('[ContactForm] Render state:', {
    showConfirmationModal,
    hasConfirmationData: !!confirmationData,
  });

  return (
    <>
      {confirmationData && showConfirmationModal && (
        <ConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => {
            console.log('[ContactForm] Modal close requested');
            setShowConfirmationModal(false);
            setConfirmationData(null);
          }}
          confirmationCode={confirmationData.confirmationCode}
          requestData={confirmationData}
        />
      )}
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

      {/* Progress Bar */}
      <ProgressBar progress={formProgress} className="mb-6" />

      {/* Submission error message */}
      {submissionError && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-red-900 font-bold mb-1">Submission Error</h4>
              <p className="text-red-800 text-sm mb-3">{submissionError}</p>
              <div className="text-xs text-red-700">
                <p className="mb-1">You can:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Try submitting again</li>
                  <li>Call us at (615) 403-4538</li>
                  <li>Email us at boxed2builtco@gmail.com</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setSubmissionError(null)}
              className="text-red-600 hover:text-red-800"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Form validation summary */}
      {submitAttempted && hasErrors && (
        <ValidationMessage
          type="error"
          message="Please fix the errors below before submitting."
          className="mb-6"
        />
      )}

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
              {isValidating && <Loader2 size={16} className="ml-2 animate-spin text-blue-600" />}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <FormField
                label="Your Name"
                required
                error={fields.name?.error}
                success={fields.name?.valid && fields.name?.touched}
                helpText="Enter your full name"
              >
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Smith"
                  className={getInputClasses('name')}
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck="false"
                  {...getFieldProps('name')}
                />
              </FormField>

              {/* Email */}
              <FormField
                label="Email Address"
                required
                error={fields.email?.error}
                success={fields.email?.valid && fields.email?.touched}
                helpText="We'll send your quote to this email"
              >
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="john@example.com"
                  className={getInputClasses('email')}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  {...getFieldProps('email')}
                />
              </FormField>
            </div>

            {/* Phone - Optional but prominent */}
            <div className="mt-4">
              <FormField
                label="Phone Number (optional - for faster response)"
                error={fields.phone?.error}
                success={fields.phone?.valid && fields.phone?.touched && fields.phone?.value}
                helpText="10-digit US phone number"
              >
                <InputMask
                  mask="(999) 999-9999"
                  {...getFieldProps('phone')}
                >
                  {(inputProps: any) => (
                    <input
                      {...inputProps}
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      className={getInputClasses('phone')}
                      placeholder="(555) 123-4567"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  )}
                </InputMask>
              </FormField>
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
              <FormField
                label="What needs assembly?"
                required
                error={fields.furnitureType?.error}
                success={fields.furnitureType?.valid && fields.furnitureType?.touched}
                helpText="Select the type of furniture you need assembled"
              >
                <select
                  id="furnitureType"
                  name="furnitureType"
                  className={getInputClasses('furnitureType')}
                  {...getFieldProps('furnitureType')}
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
              </FormField>

              {/* Pieces */}
              <FormField
                label="How many pieces?"
                required
                error={fields.pieces?.error}
                success={fields.pieces?.valid && fields.pieces?.touched}
                helpText="Number of furniture items to assemble"
              >
                <input
                  id="pieces"
                  type="number"
                  name="pieces"
                  min="1"
                  max="20"
                  className={getInputClasses('pieces')}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                  {...getFieldProps('pieces')}
                />
              </FormField>
            </div>

            {/* Conditional Notes Field for "Other" Selection */}
            {fields.furnitureType?.value === 'Other' && (
              <div className="mt-4">
                <FormField
                  label="Please specify the furniture type"
                  required
                  error={fields.notes?.error}
                  success={fields.notes?.valid && fields.notes?.touched}
                  helpText="Describe the furniture you need assembled"
                  showCharacterCount
                  maxLength={500}
                  currentLength={fields.notes?.value?.length || 0}
                >
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    className={getInputClasses('notes')}
                    placeholder="Please describe the furniture you need assembled (e.g., outdoor furniture, exercise equipment, etc.)"
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    maxLength={500}
                    {...getFieldProps('notes')}
                  />
                </FormField>
              </div>
            )}

            {/* Smart Estimation Display */}
            {estimatedTime && estimatedPrice && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-green-300 animate-fadeIn">
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center text-green-700">
                    <Clock size={16} className="mr-2" />
                    <span>Estimated time: <strong>{estimatedTime}</strong></span>
                  </div>
                  <div className="text-green-700">
                    <span>Estimated cost: <strong>{estimatedPrice}</strong></span>
                  </div>
                </div>
                <p className="text-xs text-green-600">
                  {parseInt(fields.pieces?.value || '0') > 3 && "Volume discount applied! "}
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
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              aria-expanded={showOptionalFields}
            >
              <span>Scheduling Preferences (optional)</span>
              {showOptionalFields ? (
                <ChevronUp size={16} className="text-gray-500" />
              ) : (
                <ChevronDown size={16} className="text-gray-500" />
              )}
            </button>
            
            {showOptionalFields && (
              <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg animate-fadeIn">
                {/* Preferred Date */}
                <FormField
                  label="Preferred Date"
                  error={fields.preferredDate?.error}
                  success={fields.preferredDate?.valid && fields.preferredDate?.touched && fields.preferredDate?.value}
                  helpText="When would you like the assembly completed?"
                >
                  <input
                    id="preferredDate"
                    name="preferredDate"
                    type="date"
                    className={getInputClasses('preferredDate')}
                    min={new Date().toISOString().split('T')[0]}
                    autoCapitalize="none"
                    autoCorrect="off"
                    {...getFieldProps('preferredDate')}
                  />
                </FormField>

                {/* Preferred Time Slot */}
                <FormField
                  label="Preferred Time"
                  error={fields.preferredTimeSlot?.error}
                  success={fields.preferredTimeSlot?.valid && fields.preferredTimeSlot?.touched && fields.preferredTimeSlot?.value}
                  helpText="What time works best for you?"
                >
                  <select
                    id="preferredTimeSlot"
                    name="preferredTimeSlot"
                    className={getInputClasses('preferredTimeSlot')}
                    {...getFieldProps('preferredTimeSlot')}
                  >
                    <option value="">No preference</option>
                    <option value="morning">Morning (9 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 8 PM)</option>
                    <option value="weekend">Weekend preferred</option>
                  </select>
                </FormField>

                {/* Additional Notes */}
                {fields.furnitureType?.value !== 'Other' && (
                  <FormField
                    label="Additional Details"
                    error={fields.notes?.error}
                    warning={fields.notes?.warning}
                    success={fields.notes?.valid && fields.notes?.touched && fields.notes?.value}
                    helpText="Any special requirements or questions?"
                    showCharacterCount
                    maxLength={500}
                    currentLength={fields.notes?.value?.length || 0}
                  >
                    <textarea
                      id="additionalNotes"
                      name="notes"
                      rows={3}
                      className={getInputClasses('notes')}
                      placeholder="Any special requirements, access instructions, or questions..."
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      maxLength={500}
                      {...getFieldProps('notes')}
                    />
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting || (!isFormValid && submitAttempted)}
              className={`w-full py-4 px-6 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                isSubmitting || (!isFormValid && submitAttempted)
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-700 text-white hover:bg-blue-800 transform hover:-translate-y-0.5'
              }`}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Get My Free Quote
                </>
              )}
            </button>

            <p className="flex items-center justify-center gap-1 text-xs text-gray-600 mt-3">
              <Lock size={12} />
              <span>We respect your privacy. Your information is never shared or sold.</span>
            </p>

            {/* Form status messages */}
            {submitAttempted && !isFormValid && (
              <ValidationMessage
                type="warning"
                message="Please complete all required fields to submit your request."
                className="mt-4"
              />
            )}

            {state.errors && state.errors.length > 0 && (
              <ValidationMessage
                type="error"
                message="There was an error submitting your form. Please try again."
                className="mt-4"
              />
            )}
          </div>

          {/* Terms and Benefits */}
          <div className="text-center pt-4 space-y-3">
            <p className="text-xs text-gray-600">
              By submitting, you agree to our{' '}
              <a href="/terms-of-service" className="text-blue-700 hover:text-blue-800 underline">
                Terms of Service
              </a>
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-green-700 font-medium">
              <span className="flex items-center">
                <CheckCircle size={12} className="mr-1" />
                Free consultation
              </span>
              <span className="flex items-center">
                <CheckCircle size={12} className="mr-1" />
                Weekend service available
              </span>
              <span className="flex items-center">
                <CheckCircle size={12} className="mr-1" />
                No commitment required
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
    </>
  );
};

export default ContactForm;