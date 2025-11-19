import React, { useState, useEffect } from 'react';
import { X, Mail, MessageSquare, Phone, ExternalLink, Archive, CheckCircle, Trash2, FileText, Plus } from 'lucide-react';
import { FormInquiry, Invoice } from '../../lib/supabase';
import { EMAIL_TEMPLATES, SMS_TEMPLATES, openEmailClient, openSMSClient, formatPhoneForDisplay } from '../../services/communicationService';
import { archiveInquiry, deleteInquiry, logCommunication } from '../../services/inquiryService';
import { getInvoicesByInquiry } from '../../services/invoiceService';
import InvoiceFormModal from './InvoiceFormModal';

interface InquiryDetailModalProps {
  inquiry: FormInquiry;
  onClose: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onConvertToJob?: (inquiry: FormInquiry) => void;
  onRefresh?: () => void;
}

export default function InquiryDetailModal({
  inquiry,
  onClose,
  onArchive,
  onDelete,
  onConvertToJob,
  onRefresh,
}: InquiryDetailModalProps) {
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showSMSTemplates, setShowSMSTemplates] = useState(false);
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailBody, setCustomEmailBody] = useState('');
  const [customSMSMessage, setCustomSMSMessage] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [inquiry.id]);

  const loadInvoices = async () => {
    try {
      const data = await getInvoicesByInquiry(inquiry.id);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const handleSendEmail = async (templateKey?: keyof typeof EMAIL_TEMPLATES) => {
    let subject = '';
    let body = '';

    if (templateKey && templateKey !== 'custom') {
      const template = EMAIL_TEMPLATES[templateKey](inquiry);
      subject = template.subject;
      body = template.body;
    } else {
      subject = customEmailSubject;
      body = customEmailBody;
    }

    try {
      await logCommunication(inquiry.id, 'email', `Sent email: ${subject}`);
      openEmailClient(inquiry.client_email, subject, body);
      setShowEmailTemplates(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error logging email:', error);
    }
  };

  const handleSendSMS = async (templateKey?: keyof typeof SMS_TEMPLATES) => {
    if (!inquiry.client_phone) return;

    let message = '';

    if (templateKey && templateKey !== 'custom') {
      if (templateKey === 'schedule_confirmation') {
        const template = SMS_TEMPLATES[templateKey](inquiry, inquiry.preferred_date || 'TBD', inquiry.preferred_time_slot || 'TBD');
        message = template.message;
      } else {
        const template = SMS_TEMPLATES[templateKey as 'quick_response' | 'quote_provided'](inquiry);
        message = template.message;
      }
    } else {
      message = customSMSMessage;
    }

    try {
      await logCommunication(inquiry.id, 'sms', `Sent SMS: ${message.substring(0, 50)}...`);
      openSMSClient(inquiry.client_phone, message);
      setShowSMSTemplates(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this inquiry?')) return;
    try {
      await archiveInquiry(inquiry.id);
      if (onArchive) onArchive();
      onClose();
    } catch (error) {
      console.error('Error archiving:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete inquiry from ${inquiry.client_name}? This action cannot be undone and will remove this inquiry from all metrics.`)) return;
    try {
      await deleteInquiry(inquiry.id);
      if (onDelete) onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'converted_to_job':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{inquiry.client_name}</h2>
            <p className="text-sm text-slate-600 mt-1">Submitted {formatDate(inquiry.submission_date)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(inquiry.status)}`}>
              {inquiry.status.replace('_', ' ').toUpperCase()}
            </span>
            {!inquiry.viewed && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">NEW</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Contact Information</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-900">{inquiry.client_email}</p>
                </div>
                {inquiry.client_phone && (
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-900">{formatPhoneForDisplay(inquiry.client_phone)}</p>
                  </div>
                )}
                {inquiry.user_city && (
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-900">{inquiry.user_city}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Project Details</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Furniture Type</p>
                  <p className="text-sm font-medium text-slate-900">{inquiry.furniture_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Number of Pieces</p>
                  <p className="text-sm font-medium text-slate-900">{inquiry.pieces}</p>
                </div>
                {inquiry.estimated_price && (
                  <div>
                    <p className="text-xs text-slate-500">Estimated Price</p>
                    <p className="text-sm font-medium text-emerald-600">{inquiry.estimated_price}</p>
                  </div>
                )}
                {inquiry.estimated_time && (
                  <div>
                    <p className="text-xs text-slate-500">Estimated Time</p>
                    <p className="text-sm font-medium text-slate-900">{inquiry.estimated_time}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(inquiry.preferred_date || inquiry.preferred_time_slot) && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Scheduling Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                {inquiry.preferred_date && (
                  <div>
                    <p className="text-xs text-slate-500">Preferred Date</p>
                    <p className="text-sm font-medium text-slate-900">{new Date(inquiry.preferred_date).toLocaleDateString()}</p>
                  </div>
                )}
                {inquiry.preferred_time_slot && (
                  <div>
                    <p className="text-xs text-slate-500">Preferred Time</p>
                    <p className="text-sm font-medium text-slate-900">{inquiry.preferred_time_slot}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {inquiry.notes && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Additional Notes</h3>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{inquiry.notes}</p>
            </div>
          )}

          {inquiry.contact_notes && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Communication History</h3>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{inquiry.contact_notes}</p>
              <p className="text-xs text-slate-500 mt-2">
                {inquiry.response_count} {inquiry.response_count === 1 ? 'response' : 'responses'} •{' '}
                Last contact: {inquiry.last_contact_date ? formatDate(inquiry.last_contact_date) : 'N/A'}
              </p>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices
              </h3>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Create Invoice
              </button>
            </div>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-slate-500 capitalize">{invoice.invoice_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">${invoice.total_amount.toFixed(2)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Invoiced:</span>
                    <span className="font-semibold">${invoices.reduce((sum, inv) => sum + inv.total_amount, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Paid:</span>
                    <span className="font-semibold text-green-600">${invoices.reduce((sum, inv) => sum + inv.amount_paid, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Balance Due:</span>
                    <span className="font-semibold text-blue-600">${invoices.reduce((sum, inv) => sum + inv.amount_due, 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <button
                  onClick={() => setShowEmailTemplates(!showEmailTemplates)}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Send Email
                </button>
                {showEmailTemplates && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
                    <button
                      onClick={() => handleSendEmail('quote_followup')}
                      className="w-full px-3 py-2 text-sm bg-white hover:bg-slate-100 rounded border border-slate-200 text-left"
                    >
                      Quote Follow-up
                    </button>
                    <button
                      onClick={() => handleSendEmail('request_more_info')}
                      className="w-full px-3 py-2 text-sm bg-white hover:bg-slate-100 rounded border border-slate-200 text-left"
                    >
                      Request More Info
                    </button>
                    <button
                      onClick={() => handleSendEmail('schedule_consultation')}
                      className="w-full px-3 py-2 text-sm bg-white hover:bg-slate-100 rounded border border-slate-200 text-left"
                    >
                      Schedule Consultation
                    </button>
                  </div>
                )}
              </div>

              {inquiry.client_phone && (
                <div>
                  <button
                    onClick={() => setShowSMSTemplates(!showSMSTemplates)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Send SMS
                  </button>
                  {showSMSTemplates && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
                      <button
                        onClick={() => handleSendSMS('quick_response')}
                        className="w-full px-3 py-2 text-sm bg-white hover:bg-slate-100 rounded border border-slate-200 text-left"
                      >
                        Quick Response
                      </button>
                      <button
                        onClick={() => handleSendSMS('quote_provided')}
                        className="w-full px-3 py-2 text-sm bg-white hover:bg-slate-100 rounded border border-slate-200 text-left"
                      >
                        Quote Provided
                      </button>
                    </div>
                  )}
                </div>
              )}

              {inquiry.status === 'pending' && onConvertToJob && (
                <button
                  onClick={() => onConvertToJob(inquiry)}
                  className="px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  Convert to Job
                </button>
              )}

              {inquiry.status !== 'archived' && (
                <button
                  onClick={handleArchive}
                  className="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Archive className="w-5 h-5" />
                  Archive
                </button>
              )}

              <button
                onClick={handleDelete}
                className="px-4 py-3 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {showInvoiceModal && (
        <InvoiceFormModal
          businessId={inquiry.business_id}
          inquiryId={inquiry.id}
          initialData={{
            client_name: inquiry.client_name,
            client_email: inquiry.client_email,
            client_phone: inquiry.client_phone || undefined,
          }}
          onClose={() => setShowInvoiceModal(false)}
          onSaved={() => {
            setShowInvoiceModal(false);
            loadInvoices();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
