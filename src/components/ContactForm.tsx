import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock, Loader2, Lock, Image, Link, X, Calendar, Gift, Home, Building2, Tag } from 'lucide-react';
import { formatGiftCardCodeInput } from '../utils/giftCardCode';
import { lookupCouponByCode } from '../services/couponService';
import { describeDiscount, discountAmount, formatMoney, normalizeCouponCode } from '../utils/coupon';
import {
  normalizeReferralCode,
  recallReferralCode,
  rememberReferralCode,
  forgetReferralCode
} from '../services/referralQRService';
import type { CouponLookupResult } from '../types/coupon';
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
import ConfettiCanvas from './ConfettiCanvas';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../services/communicationService';

const initialValues = {
  name: { value: '', error: '', touched: false },
  email: { value: '', error: '', touched: false },
  serviceZip: { value: '', error: '', touched: false },
  phone: { value: '', error: '', touched: false },
  furnitureType: { value: '', error: '', touched: false },
  pieces: { value: '1', error: '', touched: false },
  preferredDate: { value: '', error: '', touched: false },
  preferredTimeSlot: { value: '', error: '', touched: false },
  notes: { value: '', error: '', touched: false },
  referralCode: { value: '', error: '', touched: false },
  giftCardCode: { value: '', error: '', touched: false },
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
  serviceZip: {
    required: true,
    pattern: /^\d{5}(?:-\d{4})?$/,
    custom: (value) => {
      if (!value) return 'ZIP code is required';
      const cleaned = value.trim();
      if (!/^\d{5}(?:-\d{4})?$/.test(cleaned)) {
        return 'Please enter a valid ZIP code (e.g., 37064)';
      }
      return null;
    },
    validateOnChange: true
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
  },
  referralCode: {
    required: false,
    // The box takes referral codes (B2B-NAME-XXXX) and coupon codes
    // (WELCOME25), so it can only check the shape both share. Whether a code
    // is a live coupon is answered by the lookup, not by a regex here.
    custom: (value) => {
      if (!value) return null;
      const cleaned = value.trim().toUpperCase();
      if (cleaned.length > 0 && !/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(cleaned)) {
        return 'Codes are 3–30 letters, numbers and dashes';
      }
      return null;
    }
  },
  giftCardCode: {
    required: false,
    custom: (value) => {
      if (!value) return null;
      const cleaned = value.trim().toUpperCase();
      if (cleaned.length > 0 && !/^B2B-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(cleaned)) {
        return 'Gift card codes look like B2B-XXXX-XXXX';
      }
      return null;
    }
  }
};

interface ContactFormProps {
  /** When true, the parent renders a vertical progress rail; hide the top bar on lg. */
  sideRail?: boolean;
  /** Notifies the parent of completion percentage so it can drive an external rail. */
  onProgressChange?: (progress: number) => void;
}

const ContactForm: React.FC<ContactFormProps> = ({ sideRail = false, onProgressChange }) => {
  // Must start false so the initial render matches the SSG snapshot.
  // InputMask@2 renders differently between Node (SSG) and the browser,
  // so we swap it in after mount to avoid hydration mismatch.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [clientType, setClientType] = useState<'residential' | 'business'>('residential');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showFurnitureReference, setShowFurnitureReference] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  // The code box takes either a friend's referral code or one of our coupon
  // codes. Only a coupon changes the price, so it is looked up on blur and the
  // result parked here; anything else falls through as a referral code.
  const [appliedCoupon, setAppliedCoupon] = useState<CouponLookupResult | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponRejected, setCouponRejected] = useState(false);
  // Set when the code was prefilled from a referral link, so the box can show
  // a welcome instead of the coupon miss a referral code always produces.
  const [prefilledReferral, setPrefilledReferral] = useState<string | null>(null);
  const checkedCodeRef = useRef<string | null>(null);
  const [, setIsIOS] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { data: businessData } = useBusinessDataWithFallback();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || "+16154034538").replace(/^\+1/, ""));
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

  const [searchParams] = useSearchParams();

  // Prefill gift card code from URL (?gift_card_code=...)
  useEffect(() => {
    const codeParam = searchParams.get('gift_card_code');
    if (codeParam) {
      const formatted = formatGiftCardCodeInput(codeParam);
      handleFieldChange('giftCardCode', formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Confirms a code against the coupon table. The lookup answers only for codes
   * that are live right now, so a miss is not an error the customer needs to
   * act on — it just means the code is a referral code, or is not ours.
   */
  const checkCouponCode = async (raw: string) => {
    const code = normalizeCouponCode(raw);

    if (checkedCodeRef.current === code) return;
    checkedCodeRef.current = code;

    setAppliedCoupon(null);
    setCouponRejected(false);

    if (code.length < 3) return;

    setCouponChecking(true);
    try {
      const coupon = await lookupCouponByCode(code);
      if (coupon) {
        setAppliedCoupon(coupon);
      } else {
        setCouponRejected(true);
      }
    } catch (error) {
      // Rate limited or offline. Submitting still records the code, so the
      // quote can be adjusted by hand rather than blocking the lead.
      console.warn('[ContactForm] Coupon lookup failed:', error);
      checkedCodeRef.current = null;
    } finally {
      setCouponChecking(false);
    }
  };

  /**
   * Prefills the shared code box from a link. Two sources feed it:
   *
   *  - `?coupon=WELCOME25` from a shared promo link, which is looked up and
   *    applied to the estimate.
   *  - `?ref=B2B-ADRIA-4F7D` from a client's referral QR, or the same code
   *    remembered from earlier in the session if the visitor browsed away and
   *    came back.
   *
   * A coupon wins when both are present: an explicit promo beats a referral.
   * A referral code is deliberately NOT run through the coupon lookup - it
   * always misses, and "Not a coupon code" is the wrong first thing to show
   * someone who just scanned a friend's token.
   */
  useEffect(() => {
    const couponParam = searchParams.get('coupon');
    if (couponParam) {
      const code = normalizeCouponCode(couponParam);
      handleFieldChange('referralCode', code);
      checkCouponCode(code);
      return;
    }

    const refParam = searchParams.get('ref');
    const code = refParam ? normalizeReferralCode(refParam) : recallReferralCode();
    if (code) {
      handleFieldChange('referralCode', code);
      setPrefilledReferral(code);
      // Hold it for the session so wandering off this page and back does not
      // silently drop the referral.
      rememberReferralCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect iOS — navigator.platform is deprecated; use maxTouchPoints + UA instead
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
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

    const requiredFields = ['name', 'email', 'serviceZip', 'furnitureType', 'pieces'];

    // Add notes as required if furniture type is "Other"
    const isOtherSelected = fields.furnitureType?.value === 'Other';
    if (isOtherSelected) {
      requiredFields.push('notes');
    }

    const completedFields = requiredFields.filter(isFieldComplete).length;
    const totalRequired = requiredFields.length;
    const progress = Math.round((completedFields / totalRequired) * 100);

    setFormProgress(progress);
    onProgressChange?.(progress);
  }, [
    onProgressChange,
    fields.name?.value,
    fields.name?.valid,
    fields.email?.value,
    fields.email?.valid,
    fields.serviceZip?.value,
    fields.serviceZip?.valid,
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

  // The number the customer is actually quoted. The coupon comes off here, so
  // every downstream copy — the confirmation screen, both emails, the saved
  // request and the admin's inquiry card — already has the discount in it.
  const baseEstimateAmount = parseFloat(estimatedPrice.replace(/[^0-9.]/g, '')) || 0;
  const couponSavings =
    appliedCoupon && baseEstimateAmount > 0 ? discountAmount(appliedCoupon, baseEstimateAmount) : 0;
  const quotedPrice = couponSavings > 0 ? formatMoney(baseEstimateAmount - couponSavings) : estimatedPrice;

  const onSubmit = handleValidatedSubmit(async (values) => {
    try {
      // Track form completion with detailed parameters
      trackFormInteraction('contact_form', 'complete', {
        page_section: 'contact_form',
        furniture_type: values.furnitureType,
        number_of_pieces: parseInt(values.pieces) || 0,
        estimated_value: quotedPrice,
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
        user_city: values.serviceZip,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        estimated_price: quotedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        referral_source: 'contact_form',
        referral_code_used: values.referralCode ? values.referralCode.trim().toUpperCase() : undefined,
        gift_card_code: values.giftCardCode ? values.giftCardCode.trim().toUpperCase() : undefined,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        coupon_discount_type: appliedCoupon ? appliedCoupon.discount_type : undefined,
        coupon_discount_value: appliedCoupon ? appliedCoupon.discount_value : undefined,
        coupon_discount_amount: couponSavings > 0 ? couponSavings : undefined,
        furniture_photo_url: furniturePhotoUrl.trim() || undefined,
        furniture_image_path: uploadedImagePath,
        client_type: clientType,
        is_test: isTest,
      });

      const savedRequest = await createSavedRequest({
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        inquiry_id: inquiry.id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        user_city: values.serviceZip,
        furniture_type: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        estimated_price: quotedPrice || undefined,
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
        userCity: values.serviceZip,
        furnitureType: values.furnitureType,
        pieces: parseInt(values.pieces) || 1,
        preferredDate: values.preferredDate || undefined,
        preferredTimeSlot: values.preferredTimeSlot || undefined,
        notes: values.notes || undefined,
        estimatedPrice: quotedPrice || undefined,
        estimatedTime: estimatedTime || undefined,
        submissionDate: savedRequest.submission_date,
      };

      setConfirmationData(confirmData);
      setShowConfetti(true);
      // The referral has been spent. Releasing it stops a second, unrelated
      // request later in the same session from picking it up again.
      forgetReferralCode();
      setTimeout(() => {
        setShowConfirmationModal(true);
      }, 700);

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
          userCity: values.serviceZip,
          furnitureType: values.furnitureType,
          pieces: parseInt(values.pieces) || 1,
          preferredDate: values.preferredDate || undefined,
          preferredTimeSlot: values.preferredTimeSlot || undefined,
          notes: values.notes || undefined,
          estimatedPrice: quotedPrice || undefined,
          estimatedTime: estimatedTime || undefined,
          confirmationCode: savedRequest.confirmation_code,
          isTest,
          furniturePhotoUrl: savedRequest.furniture_photo_url || undefined,
          furnitureImagePath: savedRequest.furniture_image_path || undefined,
          referralCodeUsed: values.referralCode ? values.referralCode.trim().toUpperCase() : undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          couponDiscountLabel: appliedCoupon ? describeDiscount(appliedCoupon) : undefined,
          clientType,
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
          estimated_price: quotedPrice,
          confirmation_code: savedRequest.confirmation_code,
        },
      });

      // Reset form AFTER showing modal
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

      // Never surface raw backend error text to visitors: it leaks table,
      // column and policy detail. The full error is in the console log above.
      const errorMessage =
        'We could not send your request. Please try again in a moment, or contact us directly.';

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


  return (
    <>
      {showConfetti && (
        <ConfettiCanvas onComplete={() => setShowConfetti(false)} />
      )}
      {confirmationData && showConfirmationModal && (
        <ConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => {
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

      {/* Progress Bar — sticky compact bar that follows the user down the form.
          Pins just below the fixed header stack via --app-header-bottom (set by
          Header; accounts for the notification bar + scroll shrink). The 96px
          fallback covers the scrolled header before JS sets the variable.
          On side-rail pages it is replaced by the vertical rail on lg+. */}
      <div
        className={`${sideRail ? 'lg:hidden ' : ''}sticky z-20 -mx-6 px-6 py-3 mb-6 bg-white/95 backdrop-blur border-b border-gray-100`}
        style={{ top: 'var(--app-header-bottom, 96px)' }}
      >
        <ProgressBar progress={formProgress} />
      </div>

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
                  <li>Call us at {phoneDisplay}</li>
                  <li>Email us at nicholas.davidson@boxed2built.com</li>
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

            {/* ZIP code and phone */}
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Service ZIP Code"
                  required
                  error={fields.serviceZip?.error}
                  success={fields.serviceZip?.valid && fields.serviceZip?.touched}
                  helpText="Used to confirm availability and estimate travel time"
                >
                  <input
                    id="serviceZip"
                    name="serviceZip"
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    pattern="[0-9-]*"
                    maxLength={10}
                    placeholder="37064"
                    className={getInputClasses('serviceZip')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    {...getFieldProps('serviceZip')}
                  />
                </FormField>

              <FormField
                label="Phone Number (optional)"
                inputId="phone"
                error={fields.phone?.error}
                success={Boolean(fields.phone?.valid && fields.phone?.touched && fields.phone?.value)}
                helpText="10-digit US phone number (for faster response)"
              >
                {isMounted ? (
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
                ) : (
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className={getInputClasses('phone')}
                    placeholder="(555) 123-4567"
                    autoCapitalize="none"
                    autoCorrect="off"
                    {...getFieldProps('phone')}
                  />
                )}
              </FormField>
              </div>
            </div>
          </div>

          {/* Project Details Group */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
              <span className="w-5 h-5 bg-green-700 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
              Project Details
            </h4>

            {/* Residential / Business Toggle */}
            <div className="mb-4 flex justify-center">
              <div className={`relative inline-flex items-center rounded-full p-0.5 bg-gradient-to-r transition-all duration-300 max-w-full ${
                    clientType === 'business'
                      ? 'from-sky-400 to-blue-500'
                      : 'from-emerald-400 to-teal-400'
                  }`}>
                <button
                  type="button"
                  onClick={() => setClientType('residential')}
                  className={`relative z-10 flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    clientType === 'residential'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-transparent text-white'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Residential
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('business')}
                  className={`relative z-10 flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    clientType === 'business'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-transparent text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Business
                </button>
              </div>
            </div>

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
                label="How many items?"
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
                    {couponSavings > 0 ? (
                      <span>
                        Estimated cost:{' '}
                        <span className="line-through text-green-600/70 mr-1">{estimatedPrice}</span>
                        <strong>{quotedPrice}</strong>
                      </span>
                    ) : (
                      <span>Estimated cost: <strong>{estimatedPrice}</strong></span>
                    )}
                  </div>
                </div>
                {couponSavings > 0 && appliedCoupon && (
                  <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 inline-flex items-center gap-1">
                    <Tag size={12} />
                    {appliedCoupon.code} · {formatMoney(couponSavings)} saved
                  </p>
                )}
                <p className="text-xs text-green-600">
                  {parseInt(fields.pieces?.value || '0') > 3 && "Multi-item discount applied! "}
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
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
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
                  success={Boolean(fields.preferredDate?.valid && fields.preferredDate?.touched && fields.preferredDate?.value)}
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
                  success={Boolean(fields.preferredTimeSlot?.valid && fields.preferredTimeSlot?.touched && fields.preferredTimeSlot?.value)}
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
                    success={Boolean(fields.notes?.valid && fields.notes?.touched && fields.notes?.value)}
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
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
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
                    Product link (Wayfair, IKEA, etc.)
                  </label>
                  <input
                    id="productUrl"
                    type="url"
                    value={furniturePhotoUrl}
                    onChange={(e) => setFurniturePhotoUrl(e.target.value)}
                    placeholder="https://www.example.com/product..."
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

          {/* Referral Code */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="referralCode" className="text-sm font-medium text-gray-700">
                Have a Referral or Coupon Code?
              </label>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
            </div>
            <input
              id="referralCode"
              name="referralCode"
              type="text"
              placeholder="e.g. WELCOME25 or B2B-JONES-4X2"
              className={getInputClasses('referralCode')}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              maxLength={30}
              {...getFieldProps('referralCode')}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                getFieldProps('referralCode').onChange({ ...e, target: { ...e.target, value: upper } });
                // A code being edited is no longer the code that was checked.
                if (appliedCoupon || couponRejected) {
                  setAppliedCoupon(null);
                  setCouponRejected(false);
                  checkedCodeRef.current = null;
                }
                if (prefilledReferral && upper !== prefilledReferral) {
                  setPrefilledReferral(null);
                }
              }}
              onBlur={(e) => {
                getFieldProps('referralCode').onBlur();
                // A prefilled referral code is already known to be a referral.
                // Checking it would only render the coupon miss.
                if (prefilledReferral && e.target.value.toUpperCase() === prefilledReferral) return;
                checkCouponCode(e.target.value);
              }}
            />
            {fields.referralCode?.error && (
              <p className="text-xs text-red-600 mt-1">{fields.referralCode.error}</p>
            )}
            {couponChecking && (
              <p className="text-xs text-gray-500 mt-1">Checking code…</p>
            )}
            {appliedCoupon && !couponChecking && (
              <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                <CheckCircle size={12} />
                {appliedCoupon.code} applied — {describeDiscount(appliedCoupon)}
                {appliedCoupon.description ? ` (${appliedCoupon.description})` : ''}
              </p>
            )}
            {prefilledReferral && !appliedCoupon && !couponChecking && (
              <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                <CheckCircle size={12} />
                Referral code applied — your friend gets $25 credit when you book.
              </p>
            )}
            {couponRejected && !couponChecking && !prefilledReferral && (
              <p className="text-xs text-gray-500 mt-1">
                Not a coupon code — we'll treat it as a referral code.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              A coupon code takes money off your quote. A friend's referral code earns them $25
              credit on their next service.
            </p>
          </div>

          {/* Gift Card Code */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift size={14} className="text-emerald-700 shrink-0" />
              <label htmlFor="giftCardCode" className="text-sm font-medium text-gray-700">
                Redeeming a Gift Card?
              </label>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>
            </div>
            <input
              id="giftCardCode"
              name="giftCardCode"
              type="text"
              placeholder="B2B-XXXX-XXXX"
              className={`${getInputClasses('giftCardCode')} font-mono tracking-wider`}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              maxLength={14}
              {...getFieldProps('giftCardCode')}
              onChange={(e) => {
                const formatted = formatGiftCardCodeInput(e.target.value);
                handleFieldChange('giftCardCode', formatted);
              }}
            />
            {fields.giftCardCode?.error && (
              <p className="text-xs text-red-600 mt-1">{fields.giftCardCode.error}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              We'll apply your credit to the final invoice. Balances never expire and partial amounts roll over.{' '}
              <a href="/redeem-gift-card" className="text-emerald-700 hover:text-emerald-800 underline font-medium">
                Check balance
              </a>
            </p>
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
