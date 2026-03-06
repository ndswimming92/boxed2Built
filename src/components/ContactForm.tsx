import React, { useState, useEffect, useRef } from 'react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock, Loader2, Lock, Image, Link, X, Calendar } from 'lucide-react';
import { trackEvent, trackFormInteraction, trackConversion } from '../utils/analytics';
import FormField from './ui/FormField';
import ValidationMessage from './ui/ValidationMessage';
import ProgressBar from './ui/ProgressBar';
import { useFormValidation, ValidationRule } from '../hooks/useFormValidation';
import { supabase } from '../lib/supabase';
import { createInquiry } from '../services/inquiryService';
import { createSavedRequest } from '../services/savedRequestService';
import { logPublicAction } from '../services/auditLogService';
import { isTestSubmission } from '../services/testIdentifierService';
import ConfirmationModal from './ConfirmationModal';

const initialValues = {
  name: { value: '', error: '', touched: false },
  email: { value: '', error: '', touched: false },
  phone: { value: '', error: '', touched: false },
  furnitureType: { value: '', error: '', touched: false },
  pieces: { value: '1', error: '', touched: false },
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
    required: false,
    custom: (value) => {
      if (!value) return null;
      const today = new Date().toISOString().split('T')[0];
      if (value < today) return 'Please select a date today or in the future';
      return null;
    }
  },
  preferredTimeSlot: {
    required: false
  }
};

const ContactForm: React.FC = () => {
  const [showOptionalFields, setShowOptionalFields] = useState(true);
  const [showFurnitureReference, setShowFurnitureReference] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [formProgress, setFormProgress] = useState(0);
  const [furniturePhotoUrl, setFurniturePhotoUrl] = useState('');
  const [furniturePhotoFile, setFurniturePhotoFile] = useState<File | null>(null);
  const [furniturePhotoPreview, setFurniturePhotoPreview] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      acc[key] = initialValues[key as keyof typeof initialValues].value;
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


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoUploadError(null);

    if (!file) {
      setFurniturePhotoFile(null);
      setFurniturePhotoPreview(null);
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setPhotoUploadError('Image must be under 10 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setPhotoUploadError('Please upload a JPG, PNG, WEBP, or GIF image');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFurniturePhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFurniturePhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setFurniturePhotoFile(null);
    setFurniturePhotoPreview(null);
    setPhotoUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

      // Save to Supabase database for admin tracking and create saved request
      const [{ data: businessInfo }, isTest] = await Promise.all([
        supabase
          .from('business_info')
          .select('id, organization_id')
          .eq('is_active', true)
          .maybeSingle(),
        isTestSubmission(values.name, values.email),
      ]);

      if (!businessInfo) {
        throw new Error('Business information not found');
      }

      let uploadedImagePath: string | undefined;
      if (furniturePhotoFile) {
        const ext = furniturePhotoFile.name.split('.').pop() || 'jpg';
        const fileName = `${businessInfo.id}/${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('furniture-photos')
          .upload(fileName, furniturePhotoFile, { contentType: furniturePhotoFile.type, upsert: false });
        if (!uploadError && uploadData) {
          uploadedImagePath = uploadData.path;
        }
      }

      const inquiry = await createInquiry({
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        estimated_price: estimatedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        referral_source: 'contact_form',
        furniture_photo_url: furniturePhotoUrl.trim() || undefined,
        furniture_image_path: uploadedImagePath,
        is_test: isTest,
      });

      const savedRequest = await createSavedRequest({
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        inquiry_id: inquiry.id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        estimated_price: estimatedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        furniture_photo_url: furniturePhotoUrl.trim() || undefined,
        furniture_image_path: uploadedImagePath,
        is_test: isTest,
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
        estimatedPrice: estimatedPrice || undefined,
        estimatedTime: estimatedTime || undefined,
        submissionDate: savedRequest.submission_date,
      };

      console.log('[ContactForm] Setting confirmation data:', confirmData);
      setConfirmationData(confirmData);

      console.log('[ContactForm] Opening modal - setting showConfirmationModal to true');
      setShowConfirmationModal(true);

      // Send emails via Resend (fire and forget — do not block the success flow)
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-form-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formType: 'contact',
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          furnitureType: values.furnitureType,
          pieces: parseInt(values.pieces) || 1,
          preferredDate: values.preferredDate || undefined,
          preferredTimeSlot: values.preferredTimeSlot || undefined,
          notes: values.notes || undefined,
          estimatedPrice: estimatedPrice || undefined,
          estimatedTime: estimatedTime || undefined,
          confirmationCode: savedRequest.confirmation_code,
          isTest,
          furniturePhotoUrl: savedRequest.furniture_photo_url || undefined,
          furnitureImagePath: savedRequest.furniture_image_path || undefined,
        }),
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          console.error('[ContactForm] Email function error:', data);
        } else {
          const r = data.emailResults;
          if (r) {
            if (!r.owner) console.warn('[ContactForm] Owner notification email failed to send');
            if (!r.client) console.warn('[ContactForm] Client confirmation email failed to send — Resend may require a paid plan to send to this address. Error:', r.clientError);
          }
        }
      }).catch((err) => {
        console.error('[ContactForm] Email send error:', err);
      });


      // Log successful form submission
      await logPublicAction({
        actionType: 'SUBMIT',
        tableName: 'form_inquiries',
        recordId: inquiry.id,
        recordIdentifier: `${values.name} - Contact Form`,
        userEmail: values.email,
        status: 'success',
        metadata: {
          form_type: 'contact_form',
          furniture_type: values.furnitureType,
          pieces: parseInt(values.pieces) || 1,
          estimated_price: estimatedPrice,
          confirmation_code: savedRequest.confirmation_code,
        },
      });

      // Reset form AFTER showing modal
      console.log('[ContactForm] Resetting form');
      reset();
      setFurniturePhotoUrl('');
      setFurniturePhotoFile(null);
      setFurniturePhotoPreview(null);
      setPhotoUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

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


      // Log failed form submission
      await logPublicAction({
        actionType: 'SUBMIT',
        tableName: 'form_inquiries',
        recordIdentifier: `${values.name} - Contact Form`,
        userEmail: values.email,
        status: 'error',
        errorMessage: errorMessage,
        metadata: {
          form_type: 'contact_form',
          furniture_type: values.furnitureType,
          pieces: parseInt(values.pieces) || 1,
          error_details: error instanceof Error ? error.stack : String(error),
        },
      });

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
                inputId="phone"
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
              <span className="w-5 h-5 bg-green-700 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
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
                label="How many furniture items need assembly"
                required
                error={fields.pieces?.error}
                success={fields.pieces?.valid && fields.pieces?.touched}
                helpText="e.g. 2 chairs + 1 desk = 3 items"
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
              className="flex items-center justify-between w-full text-left rounded-lg px-3 py-2.5 bg-blue-50 hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={showOptionalFields}
            >
              <span className="flex items-center gap-2">
                <Calendar size={16} className="text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-gray-800">Scheduling Preferences</span>
                <span className="text-xs text-blue-600 font-medium">— helps us respond faster</span>
              </span>
              {showOptionalFields ? (
                <ChevronUp size={16} className="text-blue-500 shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-blue-500 shrink-0" />
              )}
            </button>

            {showOptionalFields && (
              <div className="mt-3 space-y-4 bg-gray-50 border-l-2 border-blue-200 pl-4 pr-3 py-4 rounded-r-lg animate-fadeIn">
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
                      onKeyDown={(e) => e.stopPropagation()}
                      {...getFieldProps('notes')}
                    />
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* Furniture Reference - Optional photo/link */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowFurnitureReference(!showFurnitureReference)}
              className="flex items-center justify-between w-full text-left rounded-lg px-3 py-2.5 bg-blue-50 hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={showFurnitureReference}
            >
              <span className="flex items-center gap-2">
                <Image size={16} className="text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-gray-800">Furniture Reference</span>
                <span className="text-xs text-blue-600 font-medium">— helps us give a more accurate quote</span>
              </span>
              {showFurnitureReference ? (
                <ChevronUp size={16} className="text-blue-500 shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-blue-500 shrink-0" />
              )}
            </button>

            {showFurnitureReference && (
              <div className="mt-3 space-y-4 bg-gray-50 border-l-2 border-blue-200 pl-4 pr-3 py-4 rounded-r-lg animate-fadeIn">
                <div>
                  <label htmlFor="productUrl" className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Link size={13} />
                    Product link (Amazon, Wayfair, IKEA, etc.)
                  </label>
                  <input
                    id="productUrl"
                    type="url"
                    value={furniturePhotoUrl}
                    onChange={(e) => setFurniturePhotoUrl(e.target.value)}
                    placeholder="https://www.amazon.com/your-product..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>

                <div>
                  <label htmlFor="furniturePhoto" className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Image size={13} />
                    Upload a photo
                  </label>
                  {furniturePhotoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={furniturePhotoPreview}
                        alt="Furniture preview"
                        className="h-32 w-auto rounded-lg border border-gray-300 object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                        aria-label="Remove photo"
                      >
                        <X size={12} />
                      </button>
                      <p className="text-xs text-gray-500 mt-1.5">{furniturePhotoFile?.name}</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 group"
                    >
                      <Image size={24} className="mx-auto text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                      <p className="text-sm text-gray-600 group-hover:text-gray-700">
                        Click to upload a photo
                      </p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP up to 10 MB</p>
                      <input
                        id="furniturePhoto"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        onChange={handleFileChange}
                        className="hidden"
                        aria-label="Upload furniture photo"
                      />
                    </div>
                  )}
                  {photoUploadError && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={12} />
                      {photoUploadError}
                    </p>
                  )}
                </div>
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
