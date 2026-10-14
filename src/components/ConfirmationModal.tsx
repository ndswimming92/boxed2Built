import React, { useState } from 'react';
import Modal from './Modal';
import { CheckCircle, Download, Copy, Check, Clock, Phone } from 'lucide-react';
import { generateRequestSummaryPDF, RequestSummaryData } from '../services/pdfGenerationService';
import { trackEvent } from '../utils/analytics';
import { useBusinessDataWithFallback } from '../hooks/useBusinessData';
import { formatPhoneForDisplay } from '../services/communicationService';

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

// Marketing register shared with ContactForm: cream page, navy ink, amber accent.
const cardCls = 'bg-white border border-[#ECE3D2] rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(14,39,72,0.05)]';
const stepBadgeCls = 'w-[26px] h-[26px] shrink-0 rounded-full bg-[#0E2748] text-[#FBF8F1] text-[13px] font-bold inline-flex items-center justify-center';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="font-semibold text-[#0E2748] text-right break-words min-w-0">{value}</span>
  </div>
);

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  confirmationCode,
  requestData,
}) => {
  const [copied, setCopied] = useState(false);
  const { data: businessData } = useBusinessDataWithFallback();
  const phoneDisplay = formatPhoneForDisplay((businessData?.info?.phone || '+16154034538').replace(/^\+1/, ''));

  const handleCopyCode = () => {
    navigator.clipboard.writeText(confirmationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    trackEvent('confirmation_code_copied', 'confirmation_modal', {
      event_category: 'engagement',
      confirmation_code: confirmationCode,
    });
  };

  const handleDownloadPDF = async () => {
    const pdfData: RequestSummaryData = {
      confirmationCode,
      ...requestData,
    };

    await generateRequestSummaryPDF(pdfData);

    trackEvent('request_summary_downloaded', 'confirmation_modal', {
      event_category: 'conversion',
      confirmation_code: confirmationCode,
      furniture_type: requestData.furnitureType,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Request Confirmed"
      description="Your furniture assembly service request has been successfully submitted"
    >
      {/* Same marketing register as the quote form: cream page, navy ink, amber accent. */}
      <div className="-m-6 px-5 py-8 sm:px-6 rounded-t-lg sm:rounded-lg bg-[radial-gradient(1200px_500px_at_50%_-180px,#FBF8F1_0%,#F5EFE3_60%)]">
        <div className="text-center mb-[22px]">
          <div className="inline-flex items-center gap-2 bg-[#0E2748] text-[#FBF8F1] text-[11px] font-semibold tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441]" aria-hidden="true" />
            Quote request received
          </div>
          <div className="mt-5 mb-3 inline-flex w-16 h-16 items-center justify-center rounded-full bg-[#FBF8F1] border-2 border-[#D9A441] shadow-[0_8px_20px_rgba(217,164,65,0.25)]">
            <CheckCircle size={36} className="text-[#047857]" aria-hidden="true" />
          </div>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-[#0E2748] mb-2 leading-[1.1] tracking-[-0.01em]">
            Request Confirmed!
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-[480px] mx-auto">
            Your furniture assembly service request has been successfully submitted.
          </p>
        </div>

        <div className="flex flex-col gap-[22px] text-left">
          {/* Confirmation code */}
          <section className={`${cardCls} text-center`} aria-labelledby="confirm-code-title">
            <p id="confirm-code-title" className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#B45309] mb-3">
              Your Confirmation Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <code className="text-2xl font-bold text-[#0E2748] bg-[#FBF8F1] px-4 py-2 rounded-xl border-[1.5px] border-[#D9A441] tracking-wider">
                {confirmationCode}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-[#F5EFE3] hover:bg-[#ECE3D2] text-[#0E2748] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
                title="Copy confirmation code"
                aria-label="Copy confirmation code"
              >
                {copied ? <Check size={18} className="text-[#047857]" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Save this code to look up your request anytime at boxed2built.com/lookup-request
            </p>
          </section>

          {/* Summary */}
          <section className={cardCls} aria-labelledby="confirm-summary-title">
            <div className="flex items-center gap-2.5 mb-4">
              <span className={stepBadgeCls} aria-hidden="true">1</span>
              <h3 id="confirm-summary-title" className="text-[19px] font-bold text-[#0E2748] m-0">Request Summary</h3>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Name" value={requestData.clientName} />
              <Row label="Email" value={requestData.clientEmail} />
              {requestData.clientPhone && <Row label="Phone" value={requestData.clientPhone} />}
              {requestData.userCity && <Row label="Location" value={requestData.userCity} />}

              <div className="border-t border-[#F1E9D9] pt-3 mt-3 space-y-3">
                <Row label="Furniture" value={requestData.furnitureType} />
                <Row label="Number of Pieces" value={String(requestData.pieces)} />
              </div>

              {(requestData.preferredDate || requestData.preferredTimeSlot) && (
                <div className="border-t border-[#F1E9D9] pt-3 mt-3 space-y-3">
                  {requestData.preferredDate && (
                    <Row label="Preferred Date" value={new Date(requestData.preferredDate).toLocaleDateString()} />
                  )}
                  {requestData.preferredTimeSlot && (
                    <Row label="Time Slot" value={requestData.preferredTimeSlot} />
                  )}
                </div>
              )}

              {requestData.notes && (
                <div className="border-t border-[#F1E9D9] pt-3 mt-3">
                  <p className="text-gray-500 mb-1.5">Additional Notes</p>
                  <p className="text-sm text-[#0E2748] bg-[#FBF8F1] p-3 rounded-xl border border-[#ECE3D2]">
                    {requestData.notes}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Estimate - same navy card as the form's ballpark estimate */}
          {(requestData.estimatedPrice || requestData.estimatedTime) && (
            <div className="flex items-center justify-between gap-4 flex-wrap bg-[#0E2748] rounded-[20px] px-6 py-5 shadow-[0_14px_34px_rgba(14,39,72,0.22)]">
              <div>
                <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#D9A441] mb-1">Ballpark estimate</div>
                {requestData.estimatedTime && (
                  <div className="text-sm text-slate-300">about {requestData.estimatedTime} on site</div>
                )}
              </div>
              {requestData.estimatedPrice && (
                <div className="text-right">
                  <div className="text-[30px] font-bold text-[#FBF8F1] leading-none">from {requestData.estimatedPrice}</div>
                  <div className="text-xs text-[#8FA0B8] mt-[3px]">final quote after a quick look</div>
                </div>
              )}
            </div>
          )}

          {/* What happens next */}
          <section className={cardCls} aria-labelledby="confirm-next-title">
            <div className="flex items-center gap-2.5 mb-4">
              <span className={stepBadgeCls} aria-hidden="true">2</span>
              <h3 id="confirm-next-title" className="text-[19px] font-bold text-[#0E2748] m-0 flex items-center gap-2">
                What happens next?
                <Clock size={17} className="text-[#D9A441]" aria-hidden="true" />
              </h3>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              {[
                'We will review your project details within 24 hours',
                'You will receive a detailed quote via email',
                'Once approved, we will schedule your assembly service',
                'Our professional team will complete your assembly on time',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="w-[22px] h-[22px] shrink-0 rounded-full bg-[#F5EFE3] text-[#0E2748] text-xs font-bold inline-flex items-center justify-center" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex items-center justify-center gap-2 text-sm text-[#0E2748]">
            <Phone size={16} className="text-[#D9A441]" aria-hidden="true" />
            <span>Questions? Call us at <strong>{phoneDisplay}</strong></span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2.5 bg-[#D9A441] hover:bg-[#E9BE6A] text-[#0E2748] rounded-2xl p-[18px] text-[17px] font-bold shadow-[0_10px_24px_rgba(217,164,65,0.35)] hover:shadow-[0_14px_30px_rgba(217,164,65,0.45)] hover:-translate-y-px transition-all duration-200"
            >
              <Download size={20} aria-hidden="true" />
              Download Summary
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-white hover:bg-[#FBF8F1] text-[#0E2748] border border-[#ECE3D2] rounded-2xl font-bold transition-colors"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-[#7C6E55] text-center -mt-1.5">
            Average response time: 2-4 hours • Serving Spring Hill & surrounding areas
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
