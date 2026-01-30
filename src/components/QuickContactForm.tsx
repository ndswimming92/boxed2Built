import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trackEvent, trackFormInteraction, trackConversion } from '../utils/analytics';
import { supabase } from '../lib/supabase';
import { createInquiry } from '../services/inquiryService';

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

    try {
      trackFormInteraction('footer_quick_contact', 'submit', {
        page_section: 'footer',
      });

      const { data: businessInfo } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (!businessInfo) {
        throw new Error('Business information not found');
      }

      await createInquiry({
        business_id: businessInfo.id,
        client_name: formData.name,
        client_email: formData.email,
        furniture_type: 'General Question',
        pieces: 1,
        notes: formData.message,
        source: 'footer_quick_contact',
      });

      trackFormInteraction('footer_quick_contact', 'complete', {
        page_section: 'footer',
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

      setSubmitStatus('success');
      setFormData({ name: '', email: '', message: '' });
      setTouched({ name: false, email: false, message: false });
      setErrors({ name: '', email: '', message: '' });

      setTimeout(() => {
        setSubmitStatus('idle');
      }, 5000);

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
    const baseClasses = 'w-full px-3 py-2 bg-gray-800 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200';

    if (!touched[fieldName]) {
      return `${baseClasses} border-gray-700`;
    }

    if (errors[fieldName]) {
      return `${baseClasses} border-red-500 bg-red-900/20`;
    }

    if (formData[fieldName] && !errors[fieldName]) {
      return `${baseClasses} border-green-500 bg-green-900/20`;
    }

    return `${baseClasses} border-gray-700`;
  };

  if (submitStatus === 'success') {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-green-500 animate-fadeIn">
        <div className="flex items-center justify-center gap-3 text-green-400">
          <CheckCircle size={24} />
          <div>
            <h4 className="font-bold text-lg">Message Sent!</h4>
            <p className="text-sm text-gray-300 mt-1">We'll get back to you within 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">Quick Question?</h3>
        <p className="text-sm text-gray-300 mt-1">Send us a message and we'll respond shortly</p>
      </div>

      {submitStatus === 'error' && errorMessage && (
        <div className="mb-4 bg-red-900/30 border border-red-500 rounded-md p-3 flex items-start gap-2 animate-fadeIn">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{errorMessage}</p>
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
            <p className="text-red-400 text-xs mt-1">{errors.name}</p>
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
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
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
              <p className="text-red-400 text-xs">{errors.message}</p>
            ) : (
              <span className="text-xs text-gray-400">
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
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
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

        <p className="text-xs text-gray-400 text-center">
          All fields required • We typically respond within 24 hours
        </p>
      </form>
    </div>
  );
};

export default QuickContactForm;
