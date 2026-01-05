import React, { useState, useEffect } from 'react';
import { X, Search, FileText, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { Invoice, Job } from '../../lib/supabase';
import { getUnattachedInvoices, attachInvoiceToJob } from '../../services/invoiceService';

interface AttachInvoiceModalProps {
  job: Job;
  businessId: string;
  onClose: () => void;
  onAttached: () => void;
}

export default function AttachInvoiceModal({ job, businessId, onClose, onAttached }: AttachInvoiceModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [businessId]);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchQuery]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await getUnattachedInvoices(businessId);
      setInvoices(data);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
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

    const jobClientEmail = job.client_email?.toLowerCase();
    const jobClientName = job.client_name?.toLowerCase();

    filtered.sort((a, b) => {
      const aEmailMatch = jobClientEmail && a.client_email.toLowerCase() === jobClientEmail;
      const bEmailMatch = jobClientEmail && b.client_email.toLowerCase() === jobClientEmail;
      const aNameMatch = jobClientName && a.client_name.toLowerCase().includes(jobClientName);
      const bNameMatch = jobClientName && b.client_name.toLowerCase().includes(jobClientName);

      if (aEmailMatch && !bEmailMatch) return -1;
      if (!aEmailMatch && bEmailMatch) return 1;
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setFilteredInvoices(filtered);
  };

  const handleAttach = async () => {
    if (!selectedInvoice) return;

    const clientMismatch =
      selectedInvoice.client_email.toLowerCase() !== job.client_email?.toLowerCase() ||
      !selectedInvoice.client_name.toLowerCase().includes(job.client_name.toLowerCase());

    if (clientMismatch) {
      const confirmMessage = `Warning: The client information doesn't match perfectly.\n\nInvoice Client: ${selectedInvoice.client_name} (${selectedInvoice.client_email})\nJob Client: ${job.client_name} (${job.client_email || 'N/A'})\n\nAre you sure you want to attach this invoice?`;

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    try {
      setAttaching(true);
      setError(null);
      await attachInvoiceToJob(selectedInvoice.id, job.id);
      onAttached();
      onClose();
    } catch (err: any) {
      console.error('Error attaching invoice:', err);
      setError(err.message || 'Failed to attach invoice');
    } finally {
      setAttaching(false);
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

  const isMatchingClient = (invoice: Invoice) => {
    const jobClientEmail = job.client_email?.toLowerCase();
    const jobClientName = job.client_name?.toLowerCase();
    const emailMatch = jobClientEmail && invoice.client_email.toLowerCase() === jobClientEmail;
    const nameMatch = jobClientName && invoice.client_name.toLowerCase().includes(jobClientName);
    return emailMatch || nameMatch;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <LinkIcon className="w-6 h-6 text-emerald-600" />
              Attach Invoice to Job
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Attaching invoice to: <span className="font-medium">{job.client_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={attaching}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="p-6 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number, client name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">
                {invoices.length === 0
                  ? 'No unattached invoices available'
                  : 'No invoices match your search'
                }
              </p>
              <p className="text-sm text-slate-500">
                All invoices must be unlinked from other jobs to appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => {
                const isMatching = isMatchingClient(invoice);
                const isSelected = selectedInvoice?.id === invoice.id;

                return (
                  <button
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {invoice.invoice_number}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(invoice.status)}`}>
                            {formatStatus(invoice.status)}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded border bg-slate-100 text-slate-700 border-slate-200 capitalize">
                            {invoice.invoice_type}
                          </span>
                          {isMatching && (
                            <span className="px-2 py-1 text-xs font-medium rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
                              Matching Client
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600">
                          <p className="font-medium">{invoice.client_name}</p>
                          <p>{invoice.client_email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          ${invoice.total_amount.toFixed(2)}
                        </p>
                        {invoice.amount_due > 0 && (
                          <p className="text-sm text-orange-600 font-medium">
                            ${invoice.amount_due.toFixed(2)} due
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Date: {formatDate(invoice.invoice_date)}</span>
                      <span>Due: {formatDate(invoice.due_date)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            disabled={attaching}
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            disabled={!selectedInvoice || attaching}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {attaching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Attaching...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                Attach Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
