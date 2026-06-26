import { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Unlink, ChevronDown, ChevronUp } from 'lucide-react';
import { Invoice } from '../../lib/supabase';
import { getInvoicesByJob, detachInvoiceFromJob, getInvoice } from '../../services/invoiceService';
import { downloadInvoicePDF } from '../../utils/invoicePDFGenerator';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';

interface JobInvoicesListProps {
  jobId: string;
  businessInfo: any;
  onInvoiceDetached: () => void;
}

export default function JobInvoicesList({ jobId, businessInfo, onInvoiceDetached }: JobInvoicesListProps) {
  const { maskFinancialValue } = usePrivacyMode();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [jobId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInvoicesByJob(jobId);
      setInvoices(data);
    } catch (err: any) {
      console.error('Error fetching job invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDetach = async (invoiceId: string, invoiceNumber: string) => {
    const confirmed = confirm(
      `Are you sure you want to detach invoice ${invoiceNumber} from this job?\n\nThe invoice will not be deleted, just unlinked from this job.`
    );

    if (!confirmed) return;

    try {
      await detachInvoiceFromJob(invoiceId);
      await fetchInvoices();
      onInvoiceDetached();
    } catch (err: any) {
      console.error('Error detaching invoice:', err);
      alert(err.message || 'Failed to detach invoice');
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const fullInvoice = await getInvoice(invoice.id);
      if (fullInvoice && businessInfo) {
        await downloadInvoicePDF(fullInvoice, businessInfo);
      }
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'partially_paid':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left mb-2 hover:bg-slate-50 p-2 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">
            Invoices ({invoices.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 mt-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-slate-50 rounded-lg p-3 border border-slate-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {invoice.invoice_number}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(invoice.status)}`}>
                      {formatStatus(invoice.status)}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded border bg-slate-100 text-slate-700 border-slate-200 capitalize">
                      {invoice.invoice_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>Date: {formatDate(invoice.invoice_date)}</span>
                    <span>Due: {formatDate(invoice.due_date)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatCurrency(invoice.total_amount)}
                  </p>
                  {invoice.amount_due > 0 && (
                    <p className="text-xs text-orange-600 font-medium">
                      {formatCurrency(invoice.amount_due)} due
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => handleDownloadPDF(invoice)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </button>
                <a
                  href={`/admin/invoices`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                  title="View in Invoices page"
                >
                  <ExternalLink className="w-3 h-3" />
                  View
                </a>
                <button
                  onClick={() => handleDetach(invoice.id, invoice.invoice_number)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors ml-auto"
                  title="Detach from job"
                >
                  <Unlink className="w-3 h-3" />
                  Detach
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
