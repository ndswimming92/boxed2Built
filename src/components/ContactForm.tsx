import React, { useState } from 'react';
import { useForm, ValidationError } from '@formspree/react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle, AlertCircle, User, Mail, Phone, Package, Calendar, MessageSquare } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface FormErrors {
  name: string;
  email: string;
  phone: string;
  furnitureType: string;
  pieces: string;
  preferredTime: string;
  notes: string;
}

interface TouchedFields {
  name: boolean;
  email: boolean;
  phone: boolean;
  furnitureType: boolean;
  pieces: boolean;
  preferredTime: boolean;
  notes: boolean;
}

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mwpqepva");
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    furnitureType: '',
    pieces: '',
    preferredTime: '',
    notes: ''
  });
  const [errors, setErrors] = useState<FormErrors>({
    name: '',
    email: '',
    phone: '',
    furnitureType: '',
    pieces: '',
    preferredTime: '',
    notes: ''
  });
  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    email: false,
    phone: false,
    furnitureType: false,
    pieces: false,
    preferredTime: false,
    notes: false
  });

  // Validation functions
  const validateEmail = (email: string): string => {
    if (!email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validateName = (name: string): string => {
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return '';
  };

  const validatePhone = (phone: string): string => {
    // Phone is optional, but if provided, should be complete
    if (phone && phone.replace(/\D/g, '').length > 0 && phone.replace(/\D/g, '').length < 10) {
      return 'Please enter a complete phone number';
    }
    return '';
  };

  const validateFurnitureType = (type: string): string => {
    if (!type) return 'Please select a furniture type';
    return '';
  };

  const validatePieces = (pieces: string): string => {
    if (!pieces) return 'Number of pieces is required';
    const num = parseInt(pieces);
    if (isNaN(num) || num < 1) return 'Please enter a valid number (1 or more)';
    if (num > 50) return 'For orders over 50 pieces, please call us directly';
    return '';
  };

  // Handle input changes with validation
  const handleInputChange = (field: keyof FormErrors, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate field if it has been touched
    if (touched[field]) {
      let error = '';
      switch (field) {
        case 'name':
          error = validateName(value);
          break;
        case 'email':
          error = validateEmail(value);
          break;
        case 'phone':
          error = validatePhone(value);
          break;
        case 'furnitureType':
          error = validateFurnitureType(value);
          break;
        case 'pieces':
          error = validatePieces(value);
          break;
      }
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  // Handle field blur (when user leaves field)
  const handleBlur = (field: keyof TouchedFields) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate the field
    let error = '';
    switch (field) {
      case 'name':
        error = validateName(formData.name);
        break;
      case 'email':
        error = validateEmail(formData.email);
        break;
      case 'phone':
        error = validatePhone(formData.phone);
        break;
      case 'furnitureType':
        error = validateFurnitureType(formData.furnitureType);
        break;
      case 'pieces':
        error = validatePieces(formData.pieces);
        break;
    }
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  // Check if form is valid
  const isFormValid = () => {
    const nameError = validateName(formData.name);
    const emailError = validateEmail(formData.email);
    const phoneError = validatePhone(formData.phone);
    const furnitureTypeError = validateFurnitureType(formData.furnitureType);
    const piecesError = validatePieces(formData.pieces);
    
    return !nameError && !emailError && !phoneError && !furnitureTypeError && !piecesError;
  };

  // Handle form submission
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Mark all required fields as touched
    setTouched({
      name: true,
      email: true,
      phone: true,
      furnitureType: true,
      pieces: true,
      preferredTime: false,
      notes: false
    });

    // Validate all fields
    const newErrors = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      phone: validatePhone(formData.phone),
      furnitureType: validateFurnitureType(formData.furnitureType),
      pieces: validatePieces(formData.pieces),
      preferredTime: '',
      notes: ''
    };
    
    setErrors(newErrors);

    // Check if form is valid
    if (isFormValid()) {
      trackEvent('contact-form-submit');
      handleSubmit(e);
    } else {
      // Scroll to first error
      const firstErrorField = Object.keys(newErrors).find(key => newErrors[key as keyof FormErrors]);
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus();
      }
    }
  };

  // Get input styling based on validation state
  const getInputStyling = (field: keyof FormErrors, hasError: boolean) => {
    const baseClasses = "w-full px-4 py-3 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2";
    
    if (!touched[field]) {
      return `${baseClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
    }
    
    if (hasError) {
      return `${baseClasses} border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500`;
    }
    
    return `${baseClasses} border-green-300 bg-green-50 focus:ring-green-500 focus:border-green-500`;
  };

  if (state.succeeded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You!</h3>
        <p className="text-green-700 mb-4">
          Thanks for your furniture assembly request! We'll get back to you within 24 hours with a detailed quote.
        </p>
        <div className="bg-white rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-green-800 mb-2">What happens next?</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• We'll review your request and prepare a custom quote</li>
            <li>• You'll receive a detailed response within 24 hours</li>
            <li>• We'll schedule a convenient time for your assembly</li>
          </ul>
        </div>
        <p className="text-sm text-green-600">
          For immediate assistance, call us at{' '}
          <a href="tel:+19316741196" className="font-semibold underline">
            (931) 674-1196
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Get Your Free Quote</h3>
        <p className="text-gray-600">
          Fill out the form below and we'll provide you with a detailed quote for your furniture assembly project.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Contact Information Section */}
        <fieldset className="border border-gray-200 rounded-lg p-6">
          <legend className="text-lg font-semibold text-gray-900 px-2">Contact Information</legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-1" />
                Full Name *
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                className={getInputStyling('name', !!errors.name)}
                placeholder="Your full name"
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {touched.name && errors.name && (
                <div id="name-error" className="mt-1 flex items-center text-sm text-red-600">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.name}
                </div>
              )}
              <ValidationError prefix="Name" field="name" errors={state.errors} />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} className="inline mr-1" />
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                className={getInputStyling('email', !!errors.email)}
                placeholder="your.email@example.com"
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {touched.email && errors.email && (
                <div id="email-error" className="mt-1 flex items-center text-sm text-red-600">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.email}
                </div>
              )}
              <ValidationError prefix="Email" field="email" errors={state.errors} />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              <Phone size={16} className="inline mr-1" />
              Phone Number (optional)
            </label>
            <InputMask
              id="phone"
              name="phone"
              mask="(999) 999-9999"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
              placeholder="(555) 123-4567"
              className={getInputStyling('phone', !!errors.phone)}
            >
              {(inputProps: any) => <input type="tel" {...inputProps} />}
            </InputMask>
            {touched.phone && errors.phone && (
              <div className="mt-1 flex items-center text-sm text-red-600">
                <AlertCircle size={14} className="mr-1" />
                {errors.phone}
              </div>
            )}
          </div>
        </fieldset>

        {/* Service Details Section */}
        <fieldset className="border border-gray-200 rounded-lg p-6">
          <legend className="text-lg font-semibold text-gray-900 px-2">Service Details</legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label htmlFor="furnitureType" className="block text-sm font-medium text-gray-700 mb-2">
                <Package size={16} className="inline mr-1" />
                Type of Furniture *
              </label>
              <select
                id="furnitureType"
                name="furnitureType"
                value={formData.furnitureType}
                onChange={(e) => handleInputChange('furnitureType', e.target.value)}
                onBlur={() => handleBlur('furnitureType')}
                className={getInputStyling('furnitureType', !!errors.furnitureType)}
                aria-describedby={errors.furnitureType ? "furniture-error" : undefined}
              >
                <option value="">-- Please choose --</option>
                <option value="Bed">Bed Frame</option>
                <option value="Dresser">Dresser</option>
                <option value="Table">Table/Desk</option>
                <option value="Chair">Chair(s)</option>
                <option value="Bookshelf">Bookshelf/Storage</option>
                <option value="IKEA">IKEA Furniture</option>
                <option value="Multiple">Multiple Items</option>
                <option value="Other">Other</option>
              </select>
              {touched.furnitureType && errors.furnitureType && (
                <div id="furniture-error" className="mt-1 flex items-center text-sm text-red-600">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.furnitureType}
                </div>
              )}
              <ValidationError prefix="Furniture Type" field="furnitureType" errors={state.errors} />
            </div>

            <div>
              <label htmlFor="pieces" className="block text-sm font-medium text-gray-700 mb-2">
                <Package size={16} className="inline mr-1" />
                Number of Pieces *
              </label>
              <input
                id="pieces"
                type="number"
                name="pieces"
                min="1"
                max="50"
                value={formData.pieces}
                onChange={(e) => handleInputChange('pieces', e.target.value)}
                onBlur={() => handleBlur('pieces')}
                className={getInputStyling('pieces', !!errors.pieces)}
                placeholder="1"
                aria-describedby={errors.pieces ? "pieces-error" : undefined}
              />
              {touched.pieces && errors.pieces && (
                <div id="pieces-error" className="mt-1 flex items-center text-sm text-red-600">
                  <AlertCircle size={14} className="mr-1" />
                  {errors.pieces}
                </div>
              )}
              <ValidationError prefix="Number of Pieces" field="pieces" errors={state.errors} />
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="preferredTime" className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Preferred Date & Time
            </label>
            <input
              id="preferredTime"
              type="text"
              name="preferredTime"
              value={formData.preferredTime}
              onChange={(e) => handleInputChange('preferredTime', e.target.value)}
              onBlur={() => handleBlur('preferredTime')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="e.g., Saturday afternoon, weekday evening"
            />
            <p className="mt-1 text-xs text-gray-500">
              We'll work with your schedule to find the best time
            </p>
          </div>
        </fieldset>

        {/* Additional Information Section */}
        <fieldset className="border border-gray-200 rounded-lg p-6">
          <legend className="text-lg font-semibold text-gray-900 px-2">Additional Information</legend>
          
          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare size={16} className="inline mr-1" />
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              onBlur={() => handleBlur('notes')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
              placeholder="Any extra details about your furniture assembly project, special requirements, or questions..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Include any special instructions, access requirements, or questions you have
            </p>
          </div>
        </fieldset>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Service Area:</strong> Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas.
          </p>
        </div>

        <button
          type="submit"
          disabled={state.submitting || !isFormValid()}
          className={`w-full flex items-center justify-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
            state.submitting || !isFormValid() 
              ? 'opacity-50 cursor-not-allowed' 
              : 'transform hover:-translate-y-0.5'
          }`}
        >
          {state.submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Sending Request...
            </>
          ) : (
            <>
              <Send size={20} className="mr-2" />
              Get Free Quote
            </>
          )}
        </button>

        {state.errors && state.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <AlertCircle size={20} className="text-red-600 mr-2" />
              <p className="text-sm font-medium text-red-800">
                Please check the form for errors and try again.
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center">
          By submitting this form, you agree to our{' '}
          <a href="/terms-of-service" className="text-blue-600 hover:text-blue-800 underline">
            Terms of Service
          </a>
          . We'll respond within 24 hours with your detailed quote.
        </p>
      </form>
    </div>
  );
};

export default ContactForm;