import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Send,
  CreditCard,
  MoreVertical,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Invoice } from '../../lib/supabase';
import {
  getAllInvoices,
  getInvoiceStats,
  getInvoice,
  deleteInvoice,
  InvoiceStats,
} from '../../services/invoiceService';
import InvoiceFormModal from '../../components/admin/InvoiceFormModal';
import PaymentRecordModal from '../../components/admin/PaymentRecordModal';
import { downloadInvoicePDF } from '../../utils/invoicePDFGenerator';

export default function InvoicesPage() {
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
        const [invoicesData, statsData] = await Promise.all([
          getAllInvoices(bizData.id),
          getInvoiceStats(bizData.id),
        ]);
        setInvoices(invoicesData);
        setStats(statsData);
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

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const fullInvoice = await getInvoice(invoice.id);
      if (fullInvoice && businessInfo) {
        await downloadInvoicePDF(fullInvoice, businessInfo);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
    setOpenMenuId(null);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmMessage = `Are you sure you want to delete invoice ${invoice.invoice_number}?\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteInvoice(invoice.id);
      alert('Invoice deleted successfully.');
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
                <p className="text-sm text-slate-600 mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">${stats.totalOutstanding.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.sent + stats.partiallyPaid + stats.overdue} invoices
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
                <p className="text-2xl font-bold text-green-600">${stats.totalPaid.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">{stats.paid} paid invoices</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                <p className="text-xs text-slate-500 mt-1">Needs attention</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices by number, customer name, or email..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <select
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
                  <td colSpan={9} className="px-6 py-12 text-center">
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
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(invoice.due_date)}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      ${invoice.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-green-600 font-medium">
                      ${invoice.amount_paid.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-blue-600 font-medium">
                      ${invoice.amount_due.toFixed(2)}
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
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {showInvoiceModal && businessId && (
        <InvoiceFormModal
          businessId={businessId}
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
          onSaved={() => {
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
