import { useState, useEffect, useRef } from 'react';
import { X, Phone, ExternalLink, Archive, CheckCircle, Trash2, FileText, Plus, Copy, Lock, User, Image, Link, Building2, Clock, Tag } from 'lucide-react';
import { FormInquiry, Invoice } from '../../lib/supabase';
import { formatPhoneForDisplay } from '../../services/communicationService';
import { archiveInquiry, deleteInquiry, markAsReachedOut } from '../../services/inquiryService';
import { getInvoicesByInquiry } from '../../services/invoiceService';
import { describeDiscount, formatMoney } from '../../utils/coupon';
import { getClientById, type Client } from '../../services/clientService';
import InvoiceFormModal from './InvoiceFormModal';
import ClientDetailModal from './ClientDetailModal';

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function getResponseTimeColor(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (hours < 4) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

interface InquiryDetailModalProps {
  inquiry: FormInquiry;
  onClose: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onConvertToJob?: (inquiry: FormInquiry) => void;
  onMarkConverted?: (inquiry: FormInquiry) => void;
  onRefresh?: () => void;
}

export default function InquiryDetailModal({
  inquiry,
  onClose,
  onArchive,
  onDelete,
  onConvertToJob,
  onMarkConverted,
  onRefresh,
}: InquiryDetailModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [linkedClient, setLinkedClient] = useState<Client | null>(null);
  const [reachingOut, setReachingOut] = useState(false);
  const [localFirstResponded, setLocalFirstResponded] = useState<string | null>(inquiry.first_responded_at);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadInvoices();
    if (inquiry.client_id) {
      getClientById(inquiry.client_id).then(setLinkedClient).catch(() => {});
    }
  }, [inquiry.id]);

  useEffect(() => {
    setLocalFirstResponded(inquiry.first_responded_at);
  }, [inquiry.first_responded_at]);

  useEffect(() => {
    if (localFirstResponded) {
      const diff = (new Date(localFirstResponded).getTime() - new Date(inquiry.submission_date).getTime()) / 1000;
      setElapsed(Math.max(0, diff));
      return;
    }
    const update = () => {
      const diff = (Date.now() - new Date(inquiry.submission_date).getTime()) / 1000;
      setElapsed(Math.max(0, diff));
    };
    update();
    timerRef.current = setInterval(update, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [inquiry.submission_date, localFirstResponded]);

  const handleReachedOut = async () => {
    setReachingOut(true);
    try {
      await markAsReachedOut(inquiry.id);
      setLocalFirstResponded(new Date().toISOString());
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error marking as reached out:', error);
    } finally {
      setReachingOut(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await getInvoicesByInquiry(inquiry.id);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
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

  const handleCopyCode = async () => {
    if (!inquiry.confirmation_code) return;

    try {
      await navigator.clipboard.writeText(inquiry.confirmation_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleOpenLookupPage = () => {
    if (!inquiry.confirmation_code) return;
    const url = `/lookup-request?code=${encodeURIComponent(inquiry.confirmation_code)}&email=${encodeURIComponent(inquiry.client_email)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl max-w-4xl w-full flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
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

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(inquiry.status)}`}>
              {inquiry.status.replace('_', ' ').toUpperCase()}
            </span>
            {!inquiry.viewed && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">NEW</span>}
            {inquiry.client_type === 'business' && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Business
              </span>
            )}
            {inquiry.source === 'footer_quick_contact' && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border border-purple-300 shadow-sm">
                Quick Contact
              </span>
            )}
          </div>

          {/* Response Time Tracker */}
          <div className={`flex items-center justify-between p-4 rounded-lg border ${localFirstResponded ? getResponseTimeColor(elapsed) : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${localFirstResponded ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div>
                {localFirstResponded ? (
                  <>
                    <p className="text-sm font-semibold">Responded in {formatElapsedTime(elapsed)}</p>
                    <p className="text-xs opacity-75">First response logged {new Date(localFirstResponded).toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-amber-800">{formatElapsedTime(elapsed)} since submitted</p>
                    <p className="text-xs text-amber-600">
                      {inquiry.status === 'converted_to_job'
                        ? 'Waiting for first response — logging it wraps this inquiry up and clears it from the list'
                        : 'Waiting for first response'}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!localFirstResponded && (
              <button
                onClick={handleReachedOut}
                disabled={reachingOut}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Phone className="w-4 h-4" />
                {reachingOut ? 'Saving...' : 'I Reached Out'}
              </button>
            )}
          </div>

          {inquiry.confirmation_code && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Client Confirmation Code</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="px-3 py-2 bg-white border border-blue-300 rounded text-lg font-mono font-semibold text-blue-900">
                      {inquiry.confirmation_code}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors group relative"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-blue-600" />
                      )}
                      {copied && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap">
                          Copied!
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleOpenLookupPage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                  title="Open client lookup page"
                >
                  <ExternalLink className="w-4 h-4" />
                  View as Client
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Clients can use this code to look up their request details on your website
              </p>
            </div>
          )}

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
              {linkedClient && (
                <button
                  onClick={() => setShowClientModal(true)}
                  className="mt-3 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  View Client Profile
                </button>
              )}
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
                    {inquiry.coupon_code && (
                      <p className="text-xs text-amber-700 mt-0.5">after coupon</p>
                    )}
                  </div>
                )}
                {inquiry.coupon_code && inquiry.coupon_discount_type && (
                  <div>
                    <p className="text-xs text-slate-500">Coupon</p>
                    <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="font-mono">{inquiry.coupon_code}</span>
                      <span className="font-normal text-slate-600">
                        {describeDiscount({
                          discount_type: inquiry.coupon_discount_type,
                          discount_value: Number(inquiry.coupon_discount_value ?? 0),
                        })}
                        {inquiry.coupon_discount_amount
                          ? ` · ${formatMoney(Number(inquiry.coupon_discount_amount))} off`
                          : ''}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Added to any invoice you raise from this inquiry.
                    </p>
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


          {(inquiry.furniture_photo_url || inquiry.furniture_image_path) && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-amber-600" />
                Furniture Reference
              </h3>
              <div className="flex flex-wrap gap-4 items-start">
                {inquiry.furniture_image_path && (
                  <a
                    href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/furniture-photos/${inquiry.furniture_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/furniture-photos/${inquiry.furniture_image_path}`}
                      alt="Customer furniture photo"
                      className="h-36 w-auto rounded-lg border border-amber-300 object-cover group-hover:opacity-90 transition-opacity shadow-sm"
                    />
                    <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      View full size
                    </p>
                  </a>
                )}
                {inquiry.furniture_photo_url && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Product link</p>
                    <a
                      href={inquiry.furniture_photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 underline break-all"
                    >
                      <Link className="w-3.5 h-3.5 flex-shrink-0" />
                      {inquiry.furniture_photo_url}
                    </a>
                  </div>
                )}
              </div>
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
              {inquiry.status === 'pending' && onConvertToJob && (
                <button
                  onClick={() => onConvertToJob(inquiry)}
                  className="px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  Convert to Job
                </button>
              )}

              {inquiry.status !== 'converted_to_job' && onMarkConverted && (
                <button
                  onClick={() => onMarkConverted(inquiry)}
                  className="px-4 py-3 bg-white border border-emerald-300 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                  title="Use when a job already exists for this inquiry"
                >
                  <CheckCircle className="w-5 h-5" />
                  Mark as Converted
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

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 flex-shrink-0">
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

      {showClientModal && linkedClient && (
        <ClientDetailModal
          client={linkedClient}
          onClose={() => setShowClientModal(false)}
        />
      )}
    </div>
  );
}
