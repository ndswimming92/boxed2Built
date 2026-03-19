import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Download, CreditCard as Edit, CreditCard, Clock, CheckCircle, Trash2, Briefcase, Wrench, Link2, Send, MessageSquareQuote } from 'lucide-react';
import { supabase, Invoice } from '../../lib/supabase';
import {
  getAllInvoices,
  getInvoiceStats,
  getInvoice,
  deleteInvoice,
  logInvoiceCommunication,
  markInvoiceAsSent,
  InvoiceStats,
} from '../../services/invoiceService';
import InvoiceFormModal from '../../components/admin/InvoiceFormModal';
import PaymentRecordModal from '../../components/admin/PaymentRecordModal';
import { downloadInvoicePDF } from '../../utils/invoicePDFGenerator';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import { useToast } from '../../contexts/ToastContext';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { logAction } from '../../services/auditLogService';
import {
  generateEstimateFollowUpTemplate,
  getEstimateFollowUpDetails,
  sendEstimateFollowUpEmail,
} from '../../services/estimateFollowUpEmailService';

export default function InvoicesPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [jobsMap, setJobsMap] = useState<Map<string, any>>(new Map());
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [markingSentId, setMarkingSentId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchQuery, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bizData } = await supabase
        .from('business_info')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (bizData) {
        setBusinessId(bizData.id);
        setBusinessInfo({
          name: bizData.business_name || 'Boxed2Built',
          address: bizData.address || '',
          phone: bizData.phone || '',
          email: bizData.email || '',
          website: 'www.boxed2built.com',
        });
        const [invoicesData, statsData, jobsData] = await Promise.all([
          getAllInvoices(bizData.id),
          getInvoiceStats(bizData.id),
          supabase.from('jobs').select('*').eq('business_id', bizData.id).eq('is_active', true),
        ]);
        setInvoices(invoicesData);
        setStats(statsData);

        if (jobsData.data) {
          const map = new Map();
          jobsData.data.forEach((job: any) => {
            map.set(job.id, job);
          });
          setJobsMap(map);
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(query) ||
          inv.client_name.toLowerCase().includes(query) ||
          inv.client_email.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setShowInvoiceModal(true);
  };

  const handleCreateJobFromInvoice = (invoice: Invoice) => {
    const invoiceDate = invoice.invoice_date || null;
    const invoiceAmount = invoice.total_amount || null;

    navigate('/admin/jobs', {
      state: {
        createJobFromInvoice: {
          invoiceId: invoice.id,
          sourceInvoiceNumber: invoice.invoice_number,
          initialData: {
            client_name: invoice.client_name,
            client_email: invoice.client_email || '',
            client_phone: invoice.client_phone || '',
            location_city: invoice.client_address || '',
            quoted_price: invoiceAmount,
            final_price: invoiceAmount,
            date_quoted: invoiceDate,
            notes: `Created from invoice ${invoice.invoice_number}${invoice.notes ? `

Invoice notes:
${invoice.notes}` : ''}`,
          },
        },
      },
    });
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
    setOpenMenuId(null);
  };

  const handleRecordPayment = async (invoice: Invoice) => {
    const fullInvoice = await getInvoice(invoice.id);
    if (fullInvoice) {
      setSelectedInvoice(fullInvoice as any);
      setShowPaymentModal(true);
    }
    setOpenMenuId(null);
  };

  const handleMarkAsSent = async (invoice: Invoice) => {
    setMarkingSentId(invoice.id);
    try {
      await markInvoiceAsSent(invoice.id);
      showToast({ type: 'success', message: `Invoice ${invoice.invoice_number} marked as sent.` });
      await fetchData();
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to mark invoice as sent.' });
    } finally {
      setMarkingSentId(null);
    }
  };

  const handleCopyPaymentLink = (invoice: Invoice) => {
    const url = `${window.location.origin}/pay/${invoice.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(invoice.id);
      showToast({ type: 'success', message: 'Payment link copied to clipboard!' });
      setTimeout(() => setCopiedLinkId(null), 2500);
    }).catch(() => {
      showToast({ type: 'error', message: 'Failed to copy link.' });
    });
  };

  const APPROVAL_FOLLOW_UP_TYPES = ['estimate'];
  const APPROVAL_FOLLOW_UP_STATUSES = ['sent', 'overdue'];

  const canSendApprovalFollowUp = (invoice: Invoice) => (
    APPROVAL_FOLLOW_UP_TYPES.includes(invoice.invoice_type) &&
    APPROVAL_FOLLOW_UP_STATUSES.includes(invoice.status) &&
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled'
  );

  const handleApprovalFollowUp = async (invoice: Invoice) => {
    const details = await getEstimateFollowUpDetails(invoice, invoice.job_id ? jobsMap.get(invoice.job_id) ?? null : null);
    const { subject, body } = generateEstimateFollowUpTemplate(details);

    if (invoice.client_email) {
      try {
        await sendEstimateFollowUpEmail(details, invoice.client_email);
        await logInvoiceCommunication(
          invoice.id,
          'email',
          `Estimate acceptance follow-up email sent for ${invoice.invoice_type} ${invoice.invoice_number}.`
        );
        showToast({ type: 'success', message: `Approval follow-up sent to ${invoice.client_name}.` });
      } catch (error) {
        console.error('Error sending approval follow-up:', error);
        showToast({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to send approval follow-up.',
        });
      }
      return;
    }

    navigator.clipboard.writeText(`${subject}\n\n${body}`).then(() => {
      showToast({ type: 'success', message: 'Approval follow-up copied to clipboard.' });
    }).catch(() => {
      showToast({ type: 'error', message: 'Failed to prepare approval follow-up.' });
    });
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    setDownloadingInvoiceId(invoice.id);
    try {
      const fullInvoice = await getInvoice(invoice.id);
      if (fullInvoice && businessInfo) {
        await downloadInvoicePDF(fullInvoice, businessInfo);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast({ type: 'error', message: 'Failed to download PDF. Please try again.' });
    } finally {
      setDownloadingInvoiceId(null);
      setOpenMenuId(null);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setDeletingInvoiceId(invoiceToDelete.id);
    try {
      await deleteInvoice(invoiceToDelete.id);
      await logAction({
        actionType: 'DELETE',
        tableName: 'invoices',
        recordId: invoiceToDelete.id,
        recordIdentifier: `${invoiceToDelete.invoice_number} - ${invoiceToDelete.client_name}`,
      });
      showToast({ type: 'success', message: 'Invoice deleted successfully.' });
      setInvoiceToDelete(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      await logAction({
        actionType: 'DELETE',
        tableName: 'invoices',
        recordId: invoiceToDelete.id,
        recordIdentifier: `${invoiceToDelete.invoice_number} - ${invoiceToDelete.client_name}`,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      showToast({ type: 'error', message: 'Failed to delete invoice. Please try again.' });
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'partially_paid':
        return 'bg-orange-100 text-orange-700';
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);

    return maskFinancialValue(formatted);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
              <p className="text-slate-600">Manage customer invoices and payments</p>
            </div>
          </div>
          <button
            onClick={handleCreateInvoice}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Invoice
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Invoices</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Draft Total</p>
                <p className="text-2xl font-bold text-slate-600">{formatCurrency(stats.totalDraft)}</p>
                <p className="text-xs text-slate-500 mt-1">{stats.draft} unsent invoices</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalOutstanding)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.sent + stats.partiallyPaid + stats.overdue} invoices
                  {stats.overdue > 0 && (
                    <span className="text-red-600 font-medium ml-1">• {stats.overdue} overdue</span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-xs text-slate-500 mt-1">{stats.paid} paid invoices</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input name="searchQuery"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices by number, customer name, or email..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <select name="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Job
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Paid
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No invoices match your filters'
                        : 'No invoices yet. Create your first invoice!'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditInvoice(invoice)}
                        className="font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        {invoice.invoice_number}
                      </button>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{invoice.invoice_type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{invoice.client_name}</p>
                      <p className="text-sm text-slate-500">{invoice.client_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      {invoice.job_id && jobsMap.has(invoice.job_id) ? (
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {jobsMap.get(invoice.job_id)?.job_type || 'Job'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {jobsMap.get(invoice.job_id)?.location_city || ''}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No job linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(invoice.due_date)}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-green-600 font-medium">
                      {formatCurrency(invoice.amount_paid)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-blue-600 font-medium">
                      {formatCurrency(invoice.amount_due)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                            invoice.status
                          )}`}
                        >
                          {formatStatus(invoice.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 relative">
                        <button
                          onClick={() => handleEditInvoice(invoice)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {invoice.amount_due > 0 && invoice.status !== 'cancelled' && (
                          <button
                            onClick={() => handleRecordPayment(invoice)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Record Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {!invoice.job_id && (
                          <button
                            onClick={() => handleCreateJobFromInvoice(invoice)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Create Job From Invoice"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'draft' && (
                          <button
                            onClick={() => handleMarkAsSent(invoice)}
                            disabled={markingSentId === invoice.id}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            title="Mark as Sent"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          disabled={downloadingInvoiceId === invoice.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {canSendApprovalFollowUp(invoice) && (
                          <button
                            onClick={() => handleApprovalFollowUp(invoice)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Send Approval Follow-Up"
                            aria-label={`Send approval follow-up for ${invoice.invoice_number}`}
                          >
                            <MessageSquareQuote className="w-4 h-4" />
                          </button>
                        )}
                        {['sent', 'overdue', 'partially_paid'].includes(invoice.status) && (
                          <button
                            onClick={() => handleCopyPaymentLink(invoice)}
                            className={`p-2 rounded-lg transition-colors ${copiedLinkId === invoice.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-100'}`}
                            title="Copy Payment Link"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setInvoiceToDelete(invoice)}
                          disabled={deletingInvoiceId === invoice.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      <ConfirmActionModal
        isOpen={!!invoiceToDelete}
        title="Delete invoice"
        description={`Are you sure you want to delete invoice ${invoiceToDelete?.invoice_number || ''}? This action cannot be undone.`}
        confirmLabel="Delete Invoice"
        destructive
        isLoading={!!deletingInvoiceId}
        onCancel={() => setInvoiceToDelete(null)}
        onConfirm={handleDeleteInvoice}
      />

      {showInvoiceModal && businessId && (
        <InvoiceFormModal
          businessId={businessId}
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
          onSaved={() => {
            logAction({
              actionType: selectedInvoice ? 'UPDATE' : 'CREATE',
              tableName: 'invoices',
              recordId: selectedInvoice?.id,
              recordIdentifier: selectedInvoice
                ? `${selectedInvoice.invoice_number} - ${selectedInvoice.client_name}`
                : undefined,
            });
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
            fetchData();
          }}
        />
      )}

      {showPaymentModal && selectedInvoice && (
        <PaymentRecordModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          onPaymentRecorded={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
