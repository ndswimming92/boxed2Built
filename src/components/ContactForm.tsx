import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import InputMask from 'react-input-mask';
import {
  Send, AlertCircle, CheckCircle, ChevronDown, Loader2, Lock, Image as ImageIcon, X, Calendar,
  Gift, Home, Building2, Tag, Users, Upload, Check, BedDouble, Package, Sparkles,
} from 'lucide-react';
import { formatGiftCardCodeInput } from '../utils/giftCardCode';
import { lookupCouponByCode } from '../services/couponService';
import { describeDiscount, discountAmount, formatMoney, normalizeCouponCode } from '../utils/coupon';
import { readUTMParams, forgetUTMParams, type UTMParams } from '../utils/utmAttribution';
import {
  normalizeReferralCode,
  recallReferralCode,
  rememberReferralCode,
  forgetReferralCode
} from '../services/referralQRService';
import type { CouponLookupResult } from '../types/coupon';
import { trackEvent, trackFormInteraction, trackConversion, trackLead } from '../utils/analytics';
import { useFormValidation, ValidationRule } from '../hooks/useFormValidation';
import { supabase } from '../lib/supabase';
import { createInquiry } from '../services/inquiryService';
import { createSavedRequest } from '../services/savedRequestService';
import { logPublicAction } from '../services/auditLogService';
import { isTestSubmission } from '../services/testIdentifierService';
import ConfirmationModal from './ConfirmationModal';
import ConfettiCanvas from './ConfettiCanvas';
import { estimateTimeSaved, formatHoursRange } from '../utils/diyTimeSavings';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../services/communicationService';
import { FURNITURE, type FurnitureId } from '../utils/furnitureCatalog';

const MAX_PER_TYPE = 20;
// The old single "pieces" box capped here with the same message.
const MAX_TOTAL_ITEMS = 50;
// Jobs need two days to schedule. Weekends are fine.
const MIN_LEAD_DAYS = 2;

const emptyQty = (): Record<FurnitureId, number> =>
  ({ Chair: 0, Table: 0, Bed: 0, Dresser: 0, Bookshelf: 0, IKEA: 0, Other: 0 });

/**
 * Local-time YYYY-MM-DD, n days from today. `toISOString` is UTC, which rolls
 * over to tomorrow during a Central-time evening and would let a customer pick
 * a date one day too early.
 */
const isoDaysFromToday = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Lucide has no chair, table or dresser glyph. These follow its 24px grid and
// round caps so they sit with the Lucide icons beside them.
const svgProps = {
  width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const FurnitureIcon: React.FC<{ id: FurnitureId }> = ({ id }) => {
  switch (id) {
    case 'Chair':
      return <svg {...svgProps}><path d="M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" /><path d="M5 9h14a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1z" /><path d="M6 13v6M18 13v6" /></svg>;
    case 'Table':
      return <svg {...svgProps}><rect x="3" y="6" width="18" height="3" rx="1" /><path d="M5 9v10M19 9v10M9 9v5M15 9v5" /></svg>;
    case 'Bed':
      return <BedDouble size={28} strokeWidth={1.7} aria-hidden />;
    case 'Dresser':
      return <svg {...svgProps}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M4 9h16M4 15h16" /><path d="M10.5 6h3M10.5 12h3M10.5 18h3" /></svg>;
    case 'Bookshelf':
      return <svg {...svgProps}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M4 9h16M4 15h16" /><path d="M7 5v3M9 5v3M16 12v2" /></svg>;
    case 'IKEA':
      return <Package size={28} strokeWidth={1.7} aria-hidden />;
    default:
      return <Sparkles size={28} strokeWidth={1.7} aria-hidden />;
  }
};

// The exact wording shown beside each box. It is saved with the submission as
// proof of consent, so changing it here changes what is recorded.
const SMS_SERVICE_CONSENT_TEXT =
  'I agree to receive text messages from Boxed2Built at the mobile number above about my service request, such as quotes, appointment confirmations and reminders, and build-day updates. Consent is not a condition of purchase.';
const SMS_MARKETING_CONSENT_TEXT =
  'I also agree to receive occasional promotional text messages from Boxed2Built, such as offers and discounts, at this number. Consent is not a condition of purchase.';

// Bump when either consent text above changes; stored with each audit row.
const SMS_CONSENT_VERSION = '2026-10-24';

const initialValues: Record<string, string> = {
  name: '',
  email: '',
  phone: '',
  preferredDate: '',
  preferredTimeSlot: '',
  notes: '',
  referralCode: '',
  giftCardCode: '',
};

// The furniture picker is validated in the component (see `itemsError`); it is
// not a text field, so it does not fit the hook.
const validationRules: Record<string, ValidationRule> = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    custom: (value) => {
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
    required: true,
    custom: (value) => {
      const digits = (value || '').replace(/\D/g, '');
      if (digits.length === 0) return 'Phone number is required';
      if (digits.length < 10) return 'Please enter a complete phone number';
      if (digits.length > 11) return 'Phone number is too long';
      return null;
    }
  },
  notes: {
    required: false,
    maxLength: 500
  },
  preferredDate: {
    required: false,
    custom: (value) => {
      if (!value) return null;
      if (value < isoDaysFromToday(MIN_LEAD_DAYS)) return 'Please choose a date at least 2 days from today';
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
  /** Hide the badge and headline when the page section already introduces the form. */
  showIntro?: boolean;
}

// Marketing register: cream page, navy ink, amber accent.
const cardCls = 'bg-white border border-[#ECE3D2] rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(14,39,72,0.05)]';
const labelCls = 'block text-[13px] font-semibold text-[#0E2748] mb-1.5';
const stepBadgeCls = 'w-[26px] h-[26px] shrink-0 rounded-full bg-[#0E2748] text-[#FBF8F1] text-[13px] font-bold inline-flex items-center justify-center';
const disclosureIconCls = 'w-[38px] h-[38px] shrink-0 rounded-[10px] bg-[#F5EFE3] text-[#0E2748] inline-flex items-center justify-center';
const tooltipCls = 'absolute bottom-[26px] left-1/2 -translate-x-1/2 w-[220px] bg-[#0E2748] text-[#FBF8F1] text-xs font-medium leading-normal px-3 py-2.5 rounded-[10px] shadow-[0_10px_24px_rgba(14,39,72,0.3)] z-20';
const requiredMark = <span className="text-[#B45309]" aria-hidden="true">*</span>;

const ContactForm: React.FC<ContactFormProps> = ({ sideRail = false, onProgressChange, showIntro = true }) => {
  // Must start false so the initial render matches the SSG snapshot.
  // InputMask@2 renders differently between Node (SSG) and the browser,
  // so we swap it in after mount to avoid hydration mismatch.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [clientType, setClientType] = useState<'residential' | 'business'>('residential');
  const [qty, setQty] = useState<Record<FurnitureId, number>>(emptyQty);
  const [otherText, setOtherText] = useState('');
  const [itemsTouched, setItemsTouched] = useState(false);
  const [smsServiceOptIn, setSmsServiceOptIn] = useState(false);
  const [smsMarketingOptIn, setSmsMarketingOptIn] = useState(false);
  // Admin switch (Admin > SMS Opt-In). Stays hidden until it is known to be on.
  const [smsOptInEnabled, setSmsOptInEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('business_info')
      .select('sms_opt_in_enabled')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSmsOptInEnabled(data?.sms_opt_in_enabled === true);
      });
    return () => { cancelled = true; };
  }, []);

  const [showScheduling, setShowScheduling] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [openTip, setOpenTip] = useState<'referral' | 'gift' | null>(null);

  // The code box takes either a friend's referral code or one of our coupon
  // codes. Only a coupon changes the price, so it is looked up on blur and the
  // result parked here; anything else falls through as a referral code.
  const [appliedCoupon, setAppliedCoupon] = useState<CouponLookupResult | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponRejected, setCouponRejected] = useState(false);
  // Set when the code was prefilled from a referral link, so the box can show
  // a welcome instead of the coupon miss a referral code always produces.
  const [prefilledReferral, setPrefilledReferral] = useState<string | null>(null);
  const [utmParams, setUtmParams] = useState<UTMParams>({});
  const checkedCodeRef = useRef<string | null>(null);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { data: businessData } = useBusinessDataWithFallback();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || "+16154034538").replace(/^\+1/, ""));
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [furniturePhotoUrl, setFurniturePhotoUrl] = useState('');
  const [furniturePhotoFile, setFurniturePhotoFile] = useState<File | null>(null);
  const [furniturePhotoPreview, setFurniturePhotoPreview] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    fields,
    hasErrors,
    isValidating,
    isSubmitting,
    submitAttempted,
    handleFieldChange,
    handleSubmit: handleValidatedSubmit,
    reset,
    getFieldProps
  } = useFormValidation({
    initialValues,
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
      handleFieldChange('giftCardCode', formatGiftCardCodeInput(codeParam));
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

  // Campaign attribution off the URL. Kept separate from the code prefill
  // below, which returns early on a coupon link - attribution is captured
  // either way.
  useEffect(() => {
    setUtmParams(readUTMParams(searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Items and the estimate they add up to
  const selected = useMemo(() => FURNITURE.filter((f) => qty[f.id] > 0), [qty]);
  const totalItems = selected.reduce((n, f) => n + qty[f.id], 0);
  const totalMinutes = selected.reduce((n, f) => n + qty[f.id] * f.minutes, 0);
  const rawPrice = selected.reduce((n, f) => n + qty[f.id] * f.price, 0);
  // Volume discount for 4 or more items, as before.
  const multiItemDiscount = totalItems > 3;
  const baseEstimateAmount = Math.round(multiItemDiscount ? rawPrice * 0.9 : rawPrice);
  const estimatedPrice = totalItems ? `$${baseEstimateAmount}` : '';
  const estimatedHours = Math.round((totalMinutes / 60) * 10) / 10;
  const estimatedTime = totalItems ? `${estimatedHours} hours` : '';

  // The number the customer is actually quoted. The coupon comes off here, so
  // every downstream copy — the confirmation screen, both emails, the saved
  // request and the admin's inquiry card — already has the discount in it.
  const couponSavings =
    appliedCoupon && baseEstimateAmount > 0 ? discountAmount(appliedCoupon, baseEstimateAmount) : 0;
  const quotedPrice = couponSavings > 0 ? formatMoney(baseEstimateAmount - couponSavings) : estimatedPrice;

  const itemsError =
    totalItems === 0 ? 'Pick at least one item to assemble'
    : totalItems > MAX_TOTAL_ITEMS ? 'For large projects, please contact us directly'
    : qty.Other > 0 && !otherText.trim() ? 'Tell us what the "Something Else" item is'
    : null;

  // The backend still stores one furniture_type and a total piece count. The
  // type with the most pieces stands in for the job, and the full breakdown
  // leads the notes so the admin sees every item.
  const primaryType: FurnitureId | '' = selected.length
    ? [...selected].sort((a, b) => qty[b.id] - qty[a.id])[0].id
    : '';
  const itemBreakdown = selected
    .map((f) => `${f.id === 'Other' && otherText.trim() ? `Other (${otherText.trim()})` : f.label} ×${qty[f.id]}`)
    .join(', ');

  const toggleType = (id: FurnitureId) => {
    setItemsTouched(true);
    const turningOn = qty[id] === 0;
    setQty((q) => ({ ...q, [id]: q[id] > 0 ? 0 : 1 }));
    trackEvent('quote-tile-toggle', 'contact_form', {
      event_category: 'form_interaction',
      action_type: turningOn ? 'select' : 'deselect',
      furniture_type: id,
      element_type: 'tile',
      form_name: 'contact_form'
    });
  };

  const stepQty = (id: FurnitureId, delta: number) => {
    setItemsTouched(true);
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_PER_TYPE, q[id] + delta)) }));
  };

  // Progress: the four things a quote cannot go out without.
  const isFieldComplete = (name: string) => Boolean(fields[name]?.value?.trim() && fields[name]?.valid);
  const progressParts = [!itemsError, isFieldComplete('name'), isFieldComplete('email'), isFieldComplete('phone')];
  const formProgress = Math.round((progressParts.filter(Boolean).length / progressParts.length) * 100);
  useEffect(() => {
    onProgressChange?.(formProgress);
  }, [formProgress, onProgressChange]);
  const progressLabel =
    formProgress === 0 ? 'Just getting started'
    : formProgress < 67 ? 'Looking good'
    : formProgress < 100 ? 'Almost there'
    : 'Ready to send!';

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

  const toggleDisclosure = (section: 'scheduling' | 'reference', open: boolean) => {
    if (section === 'scheduling') setShowScheduling(!open);
    else setShowReference(!open);
    trackEvent('form-optional-fields-toggle', 'contact_form', {
      event_category: 'form_interaction',
      action_type: open ? 'hide' : 'show',
      action_value: section,
      page_section: 'contact_form',
      element_type: 'button',
      form_name: 'contact_form'
    });
  };

  const validatedSubmit = handleValidatedSubmit(async (values) => {
    // The picker lives outside the validation hook, so a valid contact section
    // must not be allowed to carry an empty or unusable item list through.
    if (itemsError) return;

    const pieces = totalItems;
    const notes = [`Items: ${itemBreakdown}`, values.notes?.trim()].filter(Boolean).join('\n\n');
    const referralCodeUsed = values.referralCode ? values.referralCode.trim().toUpperCase() : undefined;
    const giftCardCode = values.giftCardCode ? values.giftCardCode.trim().toUpperCase() : undefined;

    try {
      // Track form completion with detailed parameters
      trackFormInteraction('contact_form', 'complete', {
        page_section: 'contact_form',
        furniture_type: primaryType,
        number_of_pieces: pieces,
        estimated_value: quotedPrice,
        form_step: 'submit'
      });

      // Track conversion with enhanced parameters
      trackConversion('form_submission', 1, 'USD', {
        page_section: 'contact_form',
        conversion_type: 'lead',
        furniture_type: primaryType,
        number_of_pieces: pieces
      });

      trackEvent('contact-form-submit', 'contact_form', {
        event_category: 'conversion',
        value: 1,
        user_engagement: 'form_submission',
        element_type: 'form',
        action_type: 'submit',
        furniture_type: primaryType,
        number_of_pieces: pieces
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

      // No ZIP is asked for any more, so user_city is left empty (the column
      // is nullable) and the emails and confirmation simply omit the city row.
      const serviceTexts = smsOptInEnabled && smsServiceOptIn;
      const marketingTexts = smsOptInEnabled && smsMarketingOptIn;
      const anyTexts = serviceTexts || marketingTexts;
      const smsConsent = {
        sms_opt_in: serviceTexts,
        sms_marketing_opt_in: marketingTexts,
        sms_consent_text: anyTexts
          ? [serviceTexts && SMS_SERVICE_CONSENT_TEXT, marketingTexts && SMS_MARKETING_CONSENT_TEXT]
              .filter(Boolean)
              .join('\n')
          : undefined,
        sms_consent_timestamp: anyTexts ? new Date().toISOString() : undefined,
      };

      const inquiry = await createInquiry({
        ...smsConsent,
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: primaryType,
        pieces,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes,
        estimated_price: quotedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        referral_source: 'contact_form',
        ...utmParams,
        referral_code_used: referralCodeUsed,
        gift_card_code: giftCardCode,
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
        ...smsConsent,
        business_id: businessInfo.id,
        organization_id: businessInfo.organization_id,
        inquiry_id: inquiry.id,
        client_name: values.name,
        client_email: values.email,
        client_phone: values.phone || undefined,
        furniture_type: primaryType,
        pieces,
        preferred_date: values.preferredDate || undefined,
        preferred_time_slot: values.preferredTimeSlot || undefined,
        notes,
        estimated_price: quotedPrice || undefined,
        estimated_time: estimatedTime || undefined,
        furniture_photo_url: furniturePhotoUrl.trim() || undefined,
        furniture_image_path: uploadedImagePath,
        is_test: isTest,
      });

      // Audit row with the IP and browser, which only the server can see. The
      // consent itself is already saved on the inquiry, so a failure is logged
      // and does not block the submission.
      if (anyTexts) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-sms-consent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inquiry_id: inquiry.id,
            page_url: window.location.href,
            consent_version: SMS_CONSENT_VERSION,
          }),
        }).catch((err) => console.error('[ContactForm] SMS consent log failed:', err));
      }

      // The customer sees every item they picked, not just the primary type.
      const confirmData = {
        confirmationCode: savedRequest.confirmation_code,
        clientName: values.name,
        clientEmail: values.email,
        clientPhone: values.phone || undefined,
        furnitureType: itemBreakdown,
        pieces,
        preferredDate: values.preferredDate || undefined,
        preferredTimeSlot: values.preferredTimeSlot || undefined,
        notes: values.notes?.trim() || undefined,
        estimatedPrice: quotedPrice || undefined,
        estimatedTime: estimatedTime || undefined,
        submissionDate: savedRequest.submission_date,
      };

      setConfirmationData(confirmData);
      setShowConfetti(true);
      // Both have been spent. Releasing them stops a second, unrelated request
      // later in the same session from inheriting this one's attribution.
      forgetReferralCode();
      forgetUTMParams();
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
          furnitureType: primaryType,
          pieces,
          preferredDate: values.preferredDate || undefined,
          preferredTimeSlot: values.preferredTimeSlot || undefined,
          notes,
          estimatedPrice: quotedPrice || undefined,
          estimatedTime: estimatedTime || undefined,
          confirmationCode: savedRequest.confirmation_code,
          isTest,
          furniturePhotoUrl: savedRequest.furniture_photo_url || undefined,
          furnitureImagePath: savedRequest.furniture_image_path || undefined,
          referralCodeUsed,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          couponDiscountLabel: appliedCoupon ? describeDiscount(appliedCoupon) : undefined,
          clientType,
          smsOptInEnabled,
          smsServiceOptIn: serviceTexts,
          smsMarketingOptIn: marketingTexts,
          smsConsentTimestamp: smsConsent.sms_consent_timestamp,
        }),
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          console.error('[ContactForm] Email function error:', data);
        } else {
          const r = data.emailResults;
          if (r) {
            if (!r.owner) console.warn('[ContactForm] Owner notification email failed to send');
            if (!r.client) console.warn('[ContactForm] Customer confirmation email failed to send — Resend may require a paid plan to send to this address. Error:', r.clientError);
          }
        }
      }).catch((err) => {
        console.error('[ContactForm] Email send error:', err);
      });

      // The request is saved, so this is a real lead.
      // Flagged test submissions stay out of GA, as they do out of the admin metrics.
      if (!isTest) {
        trackLead({
          service_type: primaryType,
          form_location: sideRail ? 'home_hero' : 'contact_page',
        });
      }

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
          furniture_type: primaryType,
          items: itemBreakdown,
          pieces,
          estimated_price: quotedPrice,
          confirmation_code: savedRequest.confirmation_code,
        },
      });

      // Reset form AFTER showing modal
      reset();
      setSmsServiceOptIn(false);
      setSmsMarketingOptIn(false);
      setQty(emptyQty());
      setOtherText('');
      setItemsTouched(false);
      setFurniturePhotoUrl('');
      handleRemoveFile();
    } catch (error) {
      console.error('[ContactForm] Error during form submission:', error);

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
        errorMessage,
        metadata: {
          form_type: 'contact_form',
          furniture_type: primaryType,
          items: itemBreakdown,
          pieces,
          error_details: error instanceof Error ? error.stack : String(error),
        },
      });

      // Clear error after 10 seconds
      setTimeout(() => {
        setSubmissionError(null);
      }, 10000);
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setItemsTouched(true);
    // A past-the-cutoff date is easy to miss inside a collapsed section.
    if (fields.preferredDate?.value && fields.preferredDate.value < isoDaysFromToday(MIN_LEAD_DAYS)) {
      setShowScheduling(true);
    }
    if (itemsError) document.getElementById('quote-items')?.focus();
    // Always run field validation, so every problem shows at once.
    validatedSubmit(e);
  };

  const showFieldError = (name: string) => Boolean((fields[name]?.touched || submitAttempted) && fields[name]?.error);

  const inputCls = (name: string) => {
    const base =
      'w-full px-3.5 py-3 rounded-xl text-base text-gray-900 outline-none border-[1.5px] transition-[border-color,box-shadow] duration-200 placeholder:text-gray-400 focus:border-[#D9A441] focus:shadow-[0_0_0_3px_rgba(217,164,65,0.22)]';
    return showFieldError(name) ? `${base} border-red-500 bg-red-50` : `${base} border-gray-300 bg-white`;
  };

  // The id matches the aria-describedby that getFieldProps puts on the input.
  const fieldError = (name: string) =>
    showFieldError(name) ? (
      <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600" role="alert">{fields[name].error}</p>
    ) : null;

  const referralProps = getFieldProps('referralCode');
  const giftProps = getFieldProps('giftCardCode');
  // The "Something Else" description waits for a submit: nagging the moment the
  // tile is tapped, before there was a chance to type, reads as a scolding.
  const otherDescriptionMissing = qty.Other > 0 && !otherText.trim();
  const showItemsError = Boolean(itemsError && (submitAttempted || (itemsTouched && !otherDescriptionMissing)));
  const minDate = isoDaysFromToday(MIN_LEAD_DAYS);

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

      {/* Bleeds to the screen edge on phones so the tiles keep two across. */}
      <div className="-mx-4 sm:mx-0 bg-[radial-gradient(1200px_500px_at_50%_-180px,#FBF8F1_0%,#F5EFE3_60%)] sm:rounded-3xl px-5 py-8 sm:px-6">
        <div className="max-w-[760px] mx-auto">
          {showIntro && (
            <div className="text-center mb-[22px]">
              <div className="inline-flex items-center gap-2 bg-[#0E2748] text-[#FBF8F1] text-[11px] font-semibold tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441]" aria-hidden="true" />
                Free Quote · No payment until done
              </div>
              <h2 className="text-[30px] sm:text-[40px] font-bold text-[#0E2748] mt-4 mb-2 leading-[1.1] tracking-[-0.01em]">
                Let's turn those boxes into comfort.
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-[560px] mx-auto">
                Tap what needs building, set how many, and we'll have a quote in your inbox — usually within 2–4 hours.
              </p>
            </div>
          )}

          {/* Progress — sticky pill that follows the customer down the form.
              Pins just below the fixed header stack via --app-header-bottom (set
              by Header; accounts for the notification bar + scroll shrink). On
              side-rail pages it is replaced by the vertical rail on lg+. */}
          <div
            className={`${sideRail ? 'lg:hidden ' : ''}sticky z-20 mb-6 flex items-center gap-3 sm:gap-4 bg-[#0E2748] border border-[#0A1E38] rounded-full px-[18px] py-3 shadow-[0_10px_26px_rgba(14,39,72,0.28)]`}
            style={{ top: 'calc(var(--app-header-bottom, 96px) + 12px)' }}
            role="progressbar"
            aria-valuenow={formProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Quote form progress"
          >
            <span className="text-[13px] font-bold text-[#FBF8F1] whitespace-nowrap">{progressLabel}</span>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-white/[0.14] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#D9A441] to-[#E9BE6A] shadow-[0_0_12px_rgba(217,164,65,0.6)] transition-[width] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${formProgress}%` }}
              />
            </div>
            <span className={`text-[15px] font-bold w-[42px] text-right ${formProgress === 100 ? 'text-[#4ADE80]' : 'text-[#E9BE6A]'}`}>
              {formProgress}%
            </span>
          </div>

          {submissionError && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
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
                  type="button"
                  onClick={() => setSubmissionError(null)}
                  className="text-red-600 hover:text-red-800"
                  aria-label="Dismiss error"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <form
            ref={formRef}
            onSubmit={onSubmit}
            noValidate
            autoComplete="on"
            className="flex flex-col gap-[22px]"
          >
            {/* Step 1 — what needs assembling */}
            <section className={cardCls} aria-labelledby="quote-items-title">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <span className={stepBadgeCls} aria-hidden="true">1</span>
                <h3 id="quote-items-title" className="text-[19px] font-bold text-[#0E2748] m-0">What needs assembling?</h3>
                <span className="text-[11px] font-bold tracking-[0.04em] uppercase text-[#B45309] bg-[#FDF3E3] border border-[#F1D9AE] px-2.5 py-[3px] rounded-full">Required</span>
              </div>
              <p className="text-sm text-gray-500 mb-[18px] sm:ml-9">Pick everything that applies — then set how many of each.</p>

              <div
                id="quote-items"
                tabIndex={-1}
                role="group"
                aria-labelledby="quote-items-title"
                aria-describedby={showItemsError ? 'quote-items-error' : undefined}
                className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 outline-none"
              >
                {FURNITURE.map((f) => {
                  const n = qty[f.id];
                  const on = n > 0;
                  return (
                    <div
                      key={f.id}
                      // The whole card toggles, not just its top. The button below is the
                      // keyboard and screen-reader control (its click bubbles up to here);
                      // the stepper and text box stop propagation so adjusting a count or
                      // typing never drops the selection.
                      onClick={() => toggleType(f.id)}
                      className={`relative cursor-pointer rounded-2xl border-2 border-[#ECE3D2] transition-[box-shadow,background-color] duration-200 ${
                        on ? 'bg-[#FBF8F1] shadow-[0_0_0_2px_#D9A441,0_8px_20px_rgba(217,164,65,0.18)]' : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(14,39,72,0.08)]'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={f.label}
                        className={`block w-full text-left rounded-[14px] px-3.5 pt-4 ${on ? 'pb-0' : 'pb-3.5'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]`}
                      >
                        {on && (
                          <span className="absolute top-2.5 right-2.5 w-[22px] h-[22px] rounded-full bg-[#D9A441] text-[#0E2748] flex items-center justify-center" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                        <span className="w-[46px] h-[46px] rounded-xl bg-[#F5EFE3] text-[#0E2748] flex items-center justify-center mb-3">
                          <FurnitureIcon id={f.id} />
                        </span>
                        <span className="block text-[15px] font-bold text-[#0E2748] leading-tight">{f.label}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{f.sub ?? `from $${f.price}`}</span>
                      </button>

                      {on && (
                        <div className="px-3.5 pb-3.5">
                          <div onClick={(e) => e.stopPropagation()} className="cursor-default flex items-center justify-between mt-3 bg-[#FBF8F1] border border-[#ECE3D2] rounded-full p-1">
                            <button
                              type="button"
                              onClick={() => stepQty(f.id, -1)}
                              aria-label={`Fewer ${f.label}`}
                              className="w-[30px] h-[30px] rounded-full bg-white text-[#0E2748] text-lg font-bold leading-none shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                            >
                              −
                            </button>
                            <span className="text-[15px] font-bold text-[#0E2748]" aria-live="polite" aria-label={`${n} ${f.label}`}>{n}</span>
                            <button
                              type="button"
                              onClick={() => stepQty(f.id, 1)}
                              aria-label={`More ${f.label}`}
                              disabled={n >= MAX_PER_TYPE}
                              className="w-[30px] h-[30px] rounded-full bg-[#0E2748] text-[#FBF8F1] text-lg font-bold leading-none disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>

                          <p
                            data-testid={`time-saved-${f.id}`}
                            className="time-saved-note mt-3 text-xs leading-snug text-[#0E2748]"
                          >
                            Hiring us saves you about{' '}
                            <strong className="text-[#B45309]">{formatHoursRange(estimateTimeSaved({ [f.id]: n }))}</strong>.
                          </p>

                          {f.id === 'Other' && (
                            <input
                              id="otherItem"
                              type="text"
                              value={otherText}
                              maxLength={200}
                              onChange={(e) => setOtherText(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Tell us what it is — grill, patio set, gym…"
                              aria-label="Describe the other item"
                              className="w-full mt-2.5 px-3 py-2.5 rounded-[10px] border-[1.5px] border-gray-300 text-sm text-gray-900 bg-white outline-none placeholder:text-gray-400 focus:border-[#D9A441] focus:shadow-[0_0_0_3px_rgba(217,164,65,0.22)]"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {showItemsError && (
                <p id="quote-items-error" className="mt-3 text-sm text-red-600" role="alert">{itemsError}</p>
              )}
            </section>

            {/* Step 2 — contact */}
            <section className={cardCls} aria-labelledby="quote-contact-title">
              <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                <span className={stepBadgeCls} aria-hidden="true">2</span>
                <h3 id="quote-contact-title" className="text-[19px] font-bold text-[#0E2748] m-0">Where do we send the quote?</h3>
                {isValidating && <Loader2 size={16} className="animate-spin text-[#D9A441]" />}
                <span className="ml-auto text-xs text-gray-400"><span className="text-[#B45309] font-bold">*</span> required</span>
              </div>

              <div className="flex justify-center mb-5">
                <div className="inline-flex bg-[#F5EFE3] border border-[#ECE3D2] rounded-full p-1" role="radiogroup" aria-label="Client type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={clientType === 'residential'}
                    onClick={() => setClientType('residential')}
                    className={`inline-flex items-center gap-[7px] px-5 py-[9px] rounded-full text-sm font-bold transition-all duration-200 ${
                      clientType === 'residential' ? 'bg-[#0E2748] text-[#FBF8F1]' : 'bg-transparent text-[#0E2748]'
                    }`}
                  >
                    <Home size={16} aria-hidden /> Home
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={clientType === 'business'}
                    onClick={() => setClientType('business')}
                    className={`inline-flex items-center gap-[7px] px-5 py-[9px] rounded-full text-sm font-bold transition-all duration-200 ${
                      clientType === 'business' ? 'bg-[#D9A441] text-[#0E2748]' : 'bg-transparent text-[#8A6D2F]'
                    }`}
                  >
                    <Building2 size={16} aria-hidden /> Business
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className={labelCls}>Your name {requiredMark}</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="John Smith"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    className={inputCls('name')}
                    {...getFieldProps('name')}
                  />
                  {fieldError('name')}
                </div>
                <div>
                  <label htmlFor="email" className={labelCls}>Email address {requiredMark}</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="john@example.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={inputCls('email')}
                    {...getFieldProps('email')}
                  />
                  {fieldError('email')}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="phone" className={labelCls}>Phone number {requiredMark}</label>
                  {isMounted ? (
                    <InputMask mask="(999) 999-9999" {...getFieldProps('phone')}>
                      {(inputProps: any) => (
                        <input
                          {...inputProps}
                          id="phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="(615) 555-0199"
                          className={inputCls('phone')}
                        />
                      )}
                    </InputMask>
                  ) : (
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(615) 555-0199"
                      className={inputCls('phone')}
                      {...getFieldProps('phone')}
                    />
                  )}
                  {fieldError('phone')}
                </div>
                {smsOptInEnabled && (
                <fieldset className="sm:col-span-2 space-y-3 rounded-xl bg-[#FBF8F1] border border-[#ECE3D2] p-4">
                  <legend className="sr-only">Text message preferences</legend>
                  <label htmlFor="smsServiceOptIn" className="flex items-start gap-3 cursor-pointer">
                    <input
                      id="smsServiceOptIn"
                      name="smsServiceOptIn"
                      type="checkbox"
                      checked={smsServiceOptIn}
                      onChange={(e) => setSmsServiceOptIn(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-[#0E2748]"
                    />
                    <span className="text-[13px] leading-snug text-[#0E2748]">{SMS_SERVICE_CONSENT_TEXT}</span>
                  </label>
                  <label htmlFor="smsMarketingOptIn" className="flex items-start gap-3 cursor-pointer">
                    <input
                      id="smsMarketingOptIn"
                      name="smsMarketingOptIn"
                      type="checkbox"
                      checked={smsMarketingOptIn}
                      onChange={(e) => setSmsMarketingOptIn(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-[#0E2748]"
                    />
                    <span className="text-[13px] leading-snug text-[#0E2748]">{SMS_MARKETING_CONSENT_TEXT}</span>
                  </label>
                  <p className="text-xs leading-snug text-gray-500">
                    Message frequency varies. Message and data rates may apply. Reply STOP to cancel at any time or HELP for help.
                    Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes.
                    See our{' '}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>
                    {' '}and{' '}
                    <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>.
                  </p>
                </fieldset>
                )}
              </div>
            </section>

            {/* Optional extras */}
            <section className={`${cardCls} !py-2`} aria-label="Optional details">
              {/* Scheduling */}
              <button
                type="button"
                onClick={() => toggleDisclosure('scheduling', showScheduling)}
                aria-expanded={showScheduling}
                aria-controls="quote-scheduling"
                className="w-full flex items-center justify-between gap-2.5 py-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className={disclosureIconCls}><Calendar size={19} aria-hidden /></span>
                  <span>
                    <span className="block text-[15px] font-bold text-[#0E2748]">Scheduling preferences</span>
                    <span className="block text-[12.5px] font-semibold text-[#D9A441]">Optional — tell us when works best for you</span>
                  </span>
                </span>
                <ChevronDown size={20} aria-hidden className={`shrink-0 text-[#0E2748] transition-transform duration-[250ms] ${showScheduling ? 'rotate-180' : ''}`} />
              </button>
              {showScheduling && (
                <div id="quote-scheduling" className="pb-[18px] pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  <div className="min-w-0">
                    <label htmlFor="preferredDate" className={labelCls}>Preferred date</label>
                    {/* iOS Safari gives date inputs an intrinsic min-width and
                        centred text, which pushed the box past the card edge on
                        phones. Let it shrink, left-align it like the other
                        fields, and hold the shared input height when empty. */}
                    <input
                      id="preferredDate"
                      name="preferredDate"
                      type="date"
                      min={minDate}
                      max={isoDaysFromToday(365)}
                      className={`${inputCls('preferredDate')} block min-w-0 max-w-full min-h-[48px] appearance-none text-left [&::-webkit-date-and-time-value]:text-left`}
                      {...getFieldProps('preferredDate')}
                    />
                    {showFieldError('preferredDate') ? fieldError('preferredDate') : (
                      <p className="mt-1.5 text-xs text-gray-400">At least 2 days out — weekends welcome.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="preferredTimeSlot" className={labelCls}>Preferred time</label>
                    <select
                      id="preferredTimeSlot"
                      name="preferredTimeSlot"
                      className={inputCls('preferredTimeSlot')}
                      {...getFieldProps('preferredTimeSlot')}
                    >
                      <option value="">No preference</option>
                      <option value="morning">Morning (9 AM – 12 PM)</option>
                      <option value="afternoon">Afternoon (12 – 5 PM)</option>
                      <option value="evening">Evening (5 – 8 PM)</option>
                      <option value="weekend">Weekend preferred</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="additionalNotes" className={labelCls}>Anything else we should know?</label>
                    <textarea
                      id="additionalNotes"
                      name="notes"
                      rows={3}
                      maxLength={500}
                      placeholder="Access instructions, stairs, questions…"
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      className={inputCls('notes')}
                      {...getFieldProps('notes')}
                    />
                    {fieldError('notes')}
                  </div>
                </div>
              )}

              <div className="h-px bg-[#F1E9D9]" />

              {/* Photo / product link */}
              <button
                type="button"
                onClick={() => toggleDisclosure('reference', showReference)}
                aria-expanded={showReference}
                aria-controls="quote-reference"
                className="w-full flex items-center justify-between gap-2.5 py-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className={disclosureIconCls}><ImageIcon size={19} aria-hidden /></span>
                  <span>
                    <span className="block text-[15px] font-bold text-[#0E2748]">Add a photo or product link</span>
                    <span className="block text-[12.5px] font-semibold text-[#D9A441]">Optional — helps us give a sharper quote</span>
                  </span>
                </span>
                <ChevronDown size={20} aria-hidden className={`shrink-0 text-[#0E2748] transition-transform duration-[250ms] ${showReference ? 'rotate-180' : ''}`} />
              </button>
              {showReference && (
                <div id="quote-reference" className="pb-[18px] pt-1 flex flex-col gap-4 animate-fadeIn">
                  <div>
                    <label htmlFor="productUrl" className={labelCls}>Product link (Wayfair, IKEA, Amazon…)</label>
                    <input
                      id="productUrl"
                      type="url"
                      value={furniturePhotoUrl}
                      onChange={(e) => setFurniturePhotoUrl(e.target.value)}
                      placeholder="https://www.example.com/product…"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className={inputCls('productUrl')}
                    />
                  </div>
                  <div>
                    <span className={labelCls}>Upload a photo</span>
                    {furniturePhotoPreview ? (
                      <div className="relative inline-block">
                        <img
                          src={furniturePhotoPreview}
                          alt="Furniture preview"
                          className="h-[120px] w-auto rounded-xl border border-[#ECE3D2] object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          aria-label="Remove photo"
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#0E2748] text-white flex items-center justify-center shadow"
                        >
                          <X size={14} />
                        </button>
                        <p className="text-xs text-gray-500 mt-1.5">{furniturePhotoFile?.name}</p>
                      </div>
                    ) : (
                      <label
                        htmlFor="furniturePhoto"
                        className="flex items-center gap-3.5 border-2 border-dashed border-[#D9C6A0] hover:border-[#D9A441] rounded-[14px] p-4 cursor-pointer bg-[#FBF8F1] transition-colors"
                      >
                        <span className="w-11 h-11 rounded-[10px] bg-[#F5EFE3] text-[#0E2748] inline-flex items-center justify-center flex-shrink-0">
                          <Upload size={22} aria-hidden />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#0E2748]">Click to choose a photo</span>
                          <span className="block text-xs text-gray-400">JPG, PNG or WEBP · up to 10 MB</span>
                        </span>
                        <input
                          id="furniturePhoto"
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                          onChange={handleFileChange}
                          className="hidden"
                          aria-label="Upload furniture photo"
                        />
                      </label>
                    )}
                    {photoUploadError && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1" role="alert">
                        <AlertCircle size={12} />
                        {photoUploadError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="h-px bg-[#F1E9D9]" />

              {/* Referral / coupon + gift card */}
              <div className="py-[18px] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users size={15} className="text-[#D9A441] shrink-0" strokeWidth={2.2} aria-hidden />
                    <label htmlFor="referralCode" className="text-[13px] font-semibold text-[#0E2748]">
                      Referral or coupon code
                    </label>
                    <span className="relative inline-flex">
                      <button
                        type="button"
                        aria-label="Referral code help"
                        aria-expanded={openTip === 'referral'}
                        aria-describedby={openTip === 'referral' ? 'referral-tip' : undefined}
                        onClick={() => setOpenTip((t) => (t === 'referral' ? null : 'referral'))}
                        className="w-[17px] h-[17px] rounded-full bg-[#F5EFE3] text-[#8A6D2F] text-[11px] font-bold inline-flex items-center justify-center leading-none"
                      >
                        ?
                      </button>
                      {openTip === 'referral' && (
                        <span id="referral-tip" role="tooltip" className={tooltipCls}>
                          Have a code from a friend? Enter it here — they'll get $25 credit toward their next build once your job is done. Coupon codes work here too and take money off your quote.
                        </span>
                      )}
                    </span>
                  </div>
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    placeholder="B2B-JONES-4X2"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={30}
                    className={`${inputCls('referralCode')} uppercase`}
                    {...referralProps}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase();
                      handleFieldChange('referralCode', upper);
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
                      referralProps.onBlur();
                      // A prefilled referral code is already known to be a referral.
                      // Checking it would only render the coupon miss.
                      if (prefilledReferral && e.target.value.toUpperCase() === prefilledReferral) return;
                      checkCouponCode(e.target.value);
                    }}
                  />
                  {fieldError('referralCode')}
                  {couponChecking && (
                    <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Checking code…
                    </p>
                  )}
                  {appliedCoupon && !couponChecking && (
                    <p className="mt-1.5 text-xs font-semibold text-[#047857] flex items-center gap-1">
                      <CheckCircle size={12} className="shrink-0" />
                      {appliedCoupon.code} applied — {describeDiscount(appliedCoupon)}
                      {appliedCoupon.description ? ` (${appliedCoupon.description})` : ''}
                    </p>
                  )}
                  {prefilledReferral && !appliedCoupon && !couponChecking && (
                    <p className="mt-1.5 text-xs font-semibold text-[#047857] flex items-center gap-1">
                      <CheckCircle size={12} className="shrink-0" />
                      Referral code applied — your friend gets $25 credit when you book.
                    </p>
                  )}
                  {couponRejected && !couponChecking && !prefilledReferral && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      Not a coupon code — we'll treat it as a referral code.
                    </p>
                  )}
                  {!appliedCoupon && !prefilledReferral && !couponChecking && !couponRejected && !showFieldError('referralCode') && (
                    <p className="mt-1.5 text-xs text-gray-400">A friend's code earns them $25 credit.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Gift size={15} className="text-[#047857] shrink-0" strokeWidth={2.2} aria-hidden />
                    <label htmlFor="giftCardCode" className="text-[13px] font-semibold text-[#0E2748]">
                      Gift card
                    </label>
                    <span className="relative inline-flex">
                      <button
                        type="button"
                        aria-label="Gift card help"
                        aria-expanded={openTip === 'gift'}
                        aria-describedby={openTip === 'gift' ? 'gift-tip' : undefined}
                        onClick={() => setOpenTip((t) => (t === 'gift' ? null : 'gift'))}
                        className="w-[17px] h-[17px] rounded-full bg-[#F5EFE3] text-[#047857] text-[11px] font-bold inline-flex items-center justify-center leading-none"
                      >
                        ?
                      </button>
                      {openTip === 'gift' && (
                        <span id="gift-tip" role="tooltip" className={tooltipCls}>
                          Redeeming a Boxed2Built gift card? Enter its code to apply the balance to your quote. Balances never expire and roll over.
                        </span>
                      )}
                    </span>
                  </div>
                  <input
                    id="giftCardCode"
                    name="giftCardCode"
                    type="text"
                    placeholder="B2B-XXXX-XXXX"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={14}
                    className={`${inputCls('giftCardCode')} font-mono tracking-wider uppercase`}
                    {...giftProps}
                    onChange={(e) => handleFieldChange('giftCardCode', formatGiftCardCodeInput(e.target.value))}
                  />
                  {fieldError('giftCardCode')}
                  <p className="mt-1.5 text-xs text-gray-400">
                    Balances never expire and roll over.{' '}
                    <a href="/redeem-gift-card" className="text-[#047857] hover:text-[#065F46] underline font-medium">
                      Check balance
                    </a>
                  </p>
                </div>
              </div>
            </section>

            {/* Ballpark estimate */}
            {totalItems > 0 && (
              <div
                className="flex items-center justify-between gap-4 flex-wrap bg-[#0E2748] rounded-[20px] px-6 py-5 shadow-[0_14px_34px_rgba(14,39,72,0.22)] animate-fadeIn"
                aria-live="polite"
                data-testid="quote-estimate"
              >
                <div>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#D9A441] mb-1">Ballpark estimate</div>
                  <div className="text-sm text-slate-300">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'} · about {estimatedHours} {estimatedHours === 1 ? 'hr' : 'hrs'} on site
                  </div>
                  <div className="text-xs text-[#8FA0B8] mt-0.5 flex items-center gap-1">
                    {couponSavings > 0 && appliedCoupon ? (
                      <>
                        <Tag size={12} className="text-[#D9A441]" aria-hidden />
                        {appliedCoupon.code} · {formatMoney(couponSavings)} saved
                      </>
                    ) : multiItemDiscount ? (
                      'Multi-item 10% discount applied'
                    ) : (
                      'Includes assembly, cleanup & placement'
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[30px] font-bold text-[#FBF8F1] leading-none">
                    {couponSavings > 0 && (
                      <span className="text-base line-through text-[#8FA0B8] mr-2 align-middle">{estimatedPrice}</span>
                    )}
                    from {quotedPrice}
                  </div>
                  <div className="text-xs text-[#8FA0B8] mt-[3px]">final quote after a quick look</div>
                </div>
              </div>
            )}

            {submitAttempted && (hasErrors || itemsError) && (
              <p className="text-center text-sm text-red-600" role="alert">
                Please fix the highlighted fields before sending.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 bg-[#D9A441] hover:bg-[#E9BE6A] text-[#0E2748] rounded-2xl p-[18px] text-[17px] font-bold shadow-[0_10px_24px_rgba(217,164,65,0.35)] hover:shadow-[0_14px_30px_rgba(217,164,65,0.45)] hover:-translate-y-px transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              {isSubmitting ? 'Sending…' : 'Send Me My Free Quote'}
            </button>

            <div className="-mt-1.5 text-center space-y-1.5">
              <p className="flex items-center justify-center gap-1 text-[12.5px] text-[#7C6E55]">
                <Lock size={12} aria-hidden />
                No spam, no obligation. We'll only use this to build your quote.
              </p>
              <p className="text-xs text-[#7C6E55]">
                By submitting, you agree to our{' '}
                <a href="/terms-of-service" className="text-[#0E2748] hover:text-[#1D4ED8] underline">
                  Terms of Service
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ContactForm;
