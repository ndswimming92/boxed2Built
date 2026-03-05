import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trackEvent, trackFormInteraction, trackConversion } from '../utils/analytics';
import { supabase } from '../lib/supabase';
import { createInquiry } from '../services/inquiryService';
import { logPublicAction } from '../services/auditLogService';
import { isTestSubmission } from '../services/testIdentifierService';

const QuickContactForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    message: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (!/^[a-zA-Z\s'-]+$/.test(value)) return 'Name contains invalid characters';
        return '';

      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return '';

      case 'message':
        if (!value.trim()) return 'Message is required';
        if (value.trim().length < 10) return 'Please provide more details (at least 10 characters)';
        if (value.length > 200) return 'Message is too long (max 200 characters)';
        return '';

      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (touched[name as keyof typeof touched]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));

    trackFormInteraction('footer_quick_contact', 'blur', {
      page_section: 'footer',
      field_name: name,
      has_error: !!error,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allTouched = {
      name: true,
      email: true,
      message: true,
    };
    setTouched(allTouched);

    const validationErrors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      message: validateField('message', formData.message),
    };
    setErrors(validationErrors);

    const hasErrors = Object.values(validationErrors).some(error => error !== '');
    if (hasErrors) {
      trackFormInteraction('footer_quick_contact', 'validation_error', {
        page_section: 'footer',
        error_fields: Object.keys(validationErrors).filter(key => validationErrors[key as keyof typeof validationErrors]),
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    let supabaseSuccess = false;
    const errors: string[] = [];

    try {
      trackFormInteraction('footer_quick_contact', 'submit', {
        page_section: 'footer',
      });

      // Submit to Supabase for record-keeping
      try {
        const [{ data: businessInfo, error: businessError }, isTest] = await Promise.all([
          supabase
            .from('business_info')
            .select('id, organization_id')
            .eq('is_active', true)
            .maybeSingle(),
          isTestSubmission(formData.name, formData.email),
        ]);

        if (businessError) {
          console.error('Error fetching business info:', businessError);
          errors.push('Database save failed');
        } else if (!businessInfo) {
          console.error('No active business found');
          errors.push('Business configuration missing');
        } else {
          console.log('Creating inquiry with business_id:', businessInfo.id, 'organization_id:', businessInfo.organization_id);

          await createInquiry({
            business_id: businessInfo.id,
            organization_id: businessInfo.organization_id,
            client_name: formData.name,
            client_email: formData.email,
            furniture_type: 'General Question',
            pieces: 1,
            notes: formData.message,
            source: 'footer_quick_contact',
            is_test: isTest,
          });

          supabaseSuccess = true;
          console.log('Supabase inquiry created successfully');
        }
      } catch (supabaseError) {
        console.error('Supabase submission error:', supabaseError);
        errors.push('Database save unavailable');
      }

      // Send emails via Resend (fire and forget — do not block the success flow)
      if (supabaseSuccess) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-form-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formType: 'quick_contact',
            name: formData.name,
            email: formData.email,
            message: formData.message,
          }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            console.error('[QuickContactForm] Email function error:', data);
          } else {
            const r = data.emailResults;
            if (r) {
              if (!r.owner) console.warn('[QuickContactForm] Owner notification email failed to send');
              if (!r.client) console.warn('[QuickContactForm] Client confirmation email failed to send — Resend may require a paid plan to send to this address. Error:', r.clientError);
            }
          }
        }).catch((err) => {
          console.error('[QuickContactForm] Email send error:', err);
        });
      }

      // Show success if Supabase submission succeeded
      if (supabaseSuccess) {
        trackFormInteraction('footer_quick_contact', 'complete', {
          page_section: 'footer',
          supabase_success: supabaseSuccess,
        });

        trackConversion('quick_contact_submission', 1, 'USD', {
          page_section: 'footer',
          conversion_type: 'quick_contact',
        });

        trackEvent('quick-contact-submit', 'footer', {
          event_category: 'conversion',
          value: 1,
          user_engagement: 'form_submission',
          element_type: 'form',
          action_type: 'submit',
        });


        // Log successful form submission
        await logPublicAction({
          actionType: 'SUBMIT',
          tableName: 'form_inquiries',
          recordIdentifier: `${formData.name} - Quick Contact`,
          userEmail: formData.email,
          status: 'success',
          metadata: {
            form_type: 'quick_contact',
            message_preview: formData.message.substring(0, 50),
            supabase_success: supabaseSuccess,
            partial_failure: errors.length > 0,
          },
        });

        setSubmitStatus('success');
        setFormData({ name: '', email: '', message: '' });
        setTouched({ name: false, email: false, message: false });
        setErrors({ name: '', email: '', message: '' });

        setTimeout(() => {
          setSubmitStatus('idle');
        }, 5000);

        // Log partial failures (one succeeded, one failed)
        if (errors.length > 0) {
          console.warn('Partial submission success:', errors);
        }
      } else {
        // Both submissions failed
        throw new Error(
          errors.length > 0
            ? `Submission failed: ${errors.join(', ')}`
            : 'Unable to send message. Please try again or call us directly.'
        );
      }

    } catch (error) {
      console.error('Quick contact form submission error:', error);

      const message = error instanceof Error
        ? error.message
        : 'Unable to send message. Please try again or call us directly.';

      setErrorMessage(message);
      setSubmitStatus('error');

      trackEvent('quick-contact-error', 'footer', {
        event_category: 'error',
        error_message: message,
        supabase_success: supabaseSuccess,
      });


      // Log failed form submission
      await logPublicAction({
        actionType: 'SUBMIT',
        tableName: 'form_inquiries',
        recordIdentifier: `${formData.name} - Quick Contact`,
        userEmail: formData.email,
        status: 'error',
        errorMessage: message,
        metadata: {
          form_type: 'quick_contact',
          supabase_success: supabaseSuccess,
          error_details: error instanceof Error ? error.stack : String(error),
          failed_components: errors,
        },
      });

      setTimeout(() => {
        setSubmitStatus('idle');
        setErrorMessage('');
      }, 8000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClasses = (fieldName: keyof typeof errors) => {
    const baseClasses = 'w-full px-3 py-2 bg-white/5 backdrop-blur-sm border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-white/10 transition-all duration-200';

    if (!touched[fieldName]) {
      return `${baseClasses} border-white/10`;
    }

    if (errors[fieldName]) {
      return `${baseClasses} border-red-400/50 bg-red-500/10`;
    }

    if (formData[fieldName] && !errors[fieldName]) {
      return `${baseClasses} border-green-400/50 bg-green-500/10`;
    }

    return `${baseClasses} border-white/10`;
  };

  if (submitStatus === 'success') {
    return (
      <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-lg p-6 border border-green-400/30 shadow-xl animate-fadeIn">
        <div className="flex items-center justify-center gap-3 text-green-400">
          <CheckCircle size={24} className="drop-shadow-lg" />
          <div>
            <h4 className="font-bold text-lg drop-shadow-md">Message Received!</h4>
            <p className="text-sm text-gray-200 mt-1">Your inquiry has been saved and we'll respond within 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10 shadow-xl">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white drop-shadow-md">Quick Question?</h3>
        <p className="text-sm text-gray-200 mt-1">Send us a message and we'll respond shortly</p>
      </div>

      {submitStatus === 'error' && errorMessage && (
        <div className="mb-4 bg-red-500/10 backdrop-blur-sm border border-red-400/30 rounded-md p-3 flex items-start gap-2 animate-fadeIn">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5 drop-shadow-lg" />
          <p className="text-sm text-red-200">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="quick-name" className="sr-only">Your Name</label>
          <input
            id="quick-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your Name *"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            className={getInputClasses('name')}
            disabled={isSubmitting}
          />
          {touched.name && errors.name && (
            <p className="text-red-300 text-xs mt-1 drop-shadow-sm">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="quick-email" className="sr-only">Email Address</label>
          <input
            id="quick-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email Address *"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            className={getInputClasses('email')}
            disabled={isSubmitting}
          />
          {touched.email && errors.email && (
            <p className="text-red-300 text-xs mt-1 drop-shadow-sm">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="quick-message" className="sr-only">Your Message</label>
          <textarea
            id="quick-message"
            name="message"
            rows={3}
            placeholder="Your message (10-200 characters) *"
            value={formData.message}
            onChange={handleChange}
            onBlur={handleBlur}
            className={getInputClasses('message')}
            disabled={isSubmitting}
            maxLength={200}
          />
          <div className="flex items-center justify-between mt-1">
            {touched.message && errors.message ? (
              <p className="text-red-300 text-xs drop-shadow-sm">{errors.message}</p>
            ) : (
              <span className="text-xs text-gray-300/70">
                {formData.message.length}/200 characters
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-md font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            isSubmitting
              ? 'bg-white/5 backdrop-blur-sm text-gray-300 cursor-not-allowed border border-white/10'
              : 'bg-gradient-to-r from-blue-500/80 to-blue-600/80 backdrop-blur-sm text-white hover:from-blue-500 hover:to-blue-600 shadow-lg hover:shadow-xl border border-blue-400/30 hover:border-blue-400/50'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send size={16} />
              Send Message
            </>
          )}
        </button>

        <p className="text-xs text-gray-300/80 text-center">
          All fields required • We typically respond within 24 hours
        </p>
      </form>
    </div>
  );
};

export default QuickContactForm;
