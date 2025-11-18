import React, { useState } from 'react';
import Modal from './Modal';
import { CheckCircle, Download, Mail, Copy, Check, Loader2, Clock, Phone } from 'lucide-react';
import { generateRequestSummaryPDF, RequestSummaryData } from '../services/pdfGenerationService';
import { trackEvent } from '../utils/analytics';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  confirmationCode: string;
  requestData: {
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    furnitureType: string;
    pieces: number;
    preferredDate?: string;
    preferredTimeSlot?: string;
    notes?: string;
    userCity?: string;
    estimatedPrice?: string;
    estimatedTime?: string;
    submissionDate: string;
  };
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  confirmationCode,
  requestData,
}) => {
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(confirmationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    trackEvent('confirmation_code_copied', 'confirmation_modal', {
      event_category: 'engagement',
      confirmation_code: confirmationCode,
    });
  };

  const handleDownloadPDF = () => {
    const pdfData: RequestSummaryData = {
      confirmationCode,
      ...requestData,
    };

    generateRequestSummaryPDF(pdfData);

    trackEvent('request_summary_downloaded', 'confirmation_modal', {
      event_category: 'conversion',
      confirmation_code: confirmationCode,
      furniture_type: requestData.furnitureType,
    });
  };

  const handleEmailConfirmation = async () => {
    setEmailSending(true);

    try {
      const subject = `Your Boxed2Built Service Request - ${confirmationCode}`;
      const body = `
Thank you for requesting furniture assembly service with Boxed2Built!

Confirmation Code: ${confirmationCode}

Your Request Details:
- Furniture Type: ${requestData.furnitureType}
- Number of Pieces: ${requestData.pieces}
${requestData.estimatedPrice ? `- Estimated Cost: ${requestData.estimatedPrice}` : ''}
${requestData.estimatedTime ? `- Estimated Time: ${requestData.estimatedTime}` : ''}
${requestData.preferredDate ? `- Preferred Date: ${new Date(requestData.preferredDate).toLocaleDateString()}` : ''}
${requestData.preferredTimeSlot ? `- Preferred Time: ${requestData.preferredTimeSlot}` : ''}
${requestData.notes ? `\nAdditional Notes:\n${requestData.notes}` : ''}

What Happens Next:
1. We will review your project details within 24 hours
2. You will receive a detailed quote via email
3. Once approved, we will schedule your assembly service
4. Our professional team will complete your assembly on time

To view your request later, visit:
https://boxed2built.com/lookup-request

Enter your email (${requestData.clientEmail}) and confirmation code (${confirmationCode}) to access your saved request.

Contact Us:
Phone: (615) 403-4538
Email: boxed2builtco@gmail.com
Website: https://boxed2built.com

Thank you for choosing Boxed2Built!
Serving Spring Hill, Columbia, Franklin & Surrounding Areas
      `.trim();

      const mailtoLink = `mailto:${requestData.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);

      trackEvent('confirmation_email_sent', 'confirmation_modal', {
        event_category: 'conversion',
        confirmation_code: confirmationCode,
      });
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Request Confirmed"
      description="Your furniture assembly service request has been successfully submitted"
    >
      <div className="text-center">
        <div className="mb-6 animate-bounce">
          <CheckCircle size={64} className="text-green-600 mx-auto" />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Request Confirmed!
        </h2>

        <p className="text-lg text-gray-600 mb-6">
          Your furniture assembly service request has been successfully submitted.
        </p>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            Your Confirmation Code
          </p>
          <div className="flex items-center justify-center gap-3">
            <code className="text-2xl font-bold text-blue-700 bg-white px-4 py-2 rounded border border-blue-300">
              {confirmationCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="p-2 hover:bg-blue-100 rounded transition-colors"
              title="Copy confirmation code"
            >
              {copied ? (
                <Check size={20} className="text-green-600" />
              ) : (
                <Copy size={20} className="text-blue-600" />
              )}
            </button>
          </div>
          <p className="text-xs text-blue-700 mt-3">
            Save this code to look up your request anytime at boxed2built.com/lookup-request
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Request Summary
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-semibold text-gray-900">{requestData.clientName}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-gray-900">{requestData.clientEmail}</span>
            </div>

            {requestData.clientPhone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold text-gray-900">{requestData.clientPhone}</span>
              </div>
            )}

            {requestData.userCity && (
              <div className="flex justify-between">
                <span className="text-gray-600">Location:</span>
                <span className="font-semibold text-gray-900">{requestData.userCity}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Furniture Type:</span>
                <span className="font-semibold text-gray-900">{requestData.furnitureType}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Number of Pieces:</span>
                <span className="font-semibold text-gray-900">{requestData.pieces}</span>
              </div>
            </div>

            {(requestData.estimatedPrice || requestData.estimatedTime) && (
              <div className="border-t border-gray-200 pt-3 mt-3 bg-green-50 -mx-3 px-3 py-2 rounded">
                {requestData.estimatedPrice && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Estimated Cost:</span>
                    <span className="font-bold text-green-700">{requestData.estimatedPrice}</span>
                  </div>
                )}

                {requestData.estimatedTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Time:</span>
                    <span className="font-bold text-green-700">{requestData.estimatedTime}</span>
                  </div>
                )}
              </div>
            )}

            {(requestData.preferredDate || requestData.preferredTimeSlot) && (
              <div className="border-t border-gray-200 pt-3 mt-3">
                {requestData.preferredDate && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Preferred Date:</span>
                    <span className="font-semibold text-gray-900">
                      {new Date(requestData.preferredDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {requestData.preferredTimeSlot && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Slot:</span>
                    <span className="font-semibold text-gray-900">{requestData.preferredTimeSlot}</span>
                  </div>
                )}
              </div>
            )}

            {requestData.notes && (
              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="text-gray-600 mb-1">Additional Notes:</p>
                <p className="text-sm text-gray-900 bg-white p-2 rounded border border-gray-200">
                  {requestData.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-left">
          <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center">
            <Clock size={20} className="mr-2" />
            What Happens Next?
          </h3>

          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="font-bold text-green-700 mr-2">1.</span>
              <span>We will review your project details within 24 hours</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-green-700 mr-2">2.</span>
              <span>You will receive a detailed quote via email</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-green-700 mr-2">3.</span>
              <span>Once approved, we will schedule your assembly service</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-green-700 mr-2">4.</span>
              <span>Our professional team will complete your assembly on time</span>
            </li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-900">
            <Phone size={16} />
            <span>Questions? Call us at <strong>(615) 403-4538</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Download size={18} />
            Download Summary
          </button>

          <button
            onClick={handleEmailConfirmation}
            disabled={emailSending}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailSending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending...
              </>
            ) : emailSent ? (
              <>
                <Check size={18} />
                Sent!
              </>
            ) : (
              <>
                <Mail size={18} />
                Email Summary
              </>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
        >
          Close
        </button>

        <p className="text-xs text-gray-500 mt-4">
          Average response time: 2-4 hours • Serving Spring Hill & surrounding areas
        </p>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
