import React from 'react';
import { useForm, ValidationError } from '@formspree/react';
import InputMask from 'react-input-mask';
import { Send, CheckCircle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mwpqepva");

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    trackEvent('contact-form-submit');
    handleSubmit(e);
  };

  if (state.succeeded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You!</h3>
        <p className="text-green-700">
          Thanks for your furniture assembly request! We'll get back to you within 24 hours with a detailed quote.
        </p>
        <p className="text-sm text-green-600 mt-2">
          For immediate assistance, call us at (931) 674-1196
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              name="name"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Your full name"
            />
            <ValidationError prefix="Name" field="name" errors={state.errors} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="your.email@example.com"
            />
            <ValidationError prefix="Email" field="email" errors={state.errors} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (optional)
            </label>
            <InputMask
              id="phone"
              name="phone"
              mask="(999) 999-9999"
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {(inputProps: any) => <input type="tel" {...inputProps} />}
            </InputMask>
          </div>

          <div>
            <label htmlFor="furnitureType" className="block text-sm font-medium text-gray-700 mb-2">
              Type of Furniture *
            </label>
            <select
              id="furnitureType"
              name="furnitureType"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
            <ValidationError prefix="Furniture Type" field="furnitureType" errors={state.errors} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="pieces" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Pieces *
            </label>
            <input
              id="pieces"
              type="number"
              name="pieces"
              min="1"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="1"
            />
            <ValidationError prefix="Number of Pieces" field="pieces" errors={state.errors} />
          </div>

          <div>
            <label htmlFor="preferredTime" className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Date & Time
            </label>
            <input
              id="preferredTime"
              type="text"
              name="preferredTime"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="e.g., Saturday afternoon, weekday evening"
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
            placeholder="Any extra details about your furniture assembly project, special requirements, or questions..."
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Service Area:</strong> Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood, and surrounding Tennessee areas.
          </p>
        </div>

        <button
          type="submit"
          disabled={state.submitting}
          className={`w-full flex items-center justify-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
            state.submitting ? 'opacity-50 cursor-not-allowed' : 'transform hover:-translate-y-0.5'
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
            <p className="text-sm text-red-800">
              Please check the form for errors and try again.
            </p>
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