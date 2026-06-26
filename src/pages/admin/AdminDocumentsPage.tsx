import { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  Eye,
  EyeOff,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  Lock,
  FileText,
  Image,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  getDocumentsForAdmin,
  getCustomersForOrg,
  toggleDocumentVisibility,
  softDeleteDocument,
  getAdminDocumentSignedUrl,
  type AdminDocument,
  type CustomerOption,
  type AdminDocumentType,
} from '../../services/adminDocumentService';
import AdminDocumentUploadModal from '../../components/admin/AdminDocumentUploadModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

const DOCUMENT_TYPE_LABELS: Record<AdminDocumentType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  estimate: 'Estimate',
  job_report: 'Job Report',
  photo: 'Photo',
  agreement: 'Agreement',
  general: 'General',
  other: 'Other',
};

const TYPE_COLORS: Record<AdminDocumentType, string> = {
  invoice: 'bg-blue-100 text-blue-700',
  receipt: 'bg-amber-100 text-amber-700',
  estimate: 'bg-cyan-100 text-cyan-700',
  job_report: 'bg-emerald-100 text-emerald-700',
  photo: 'bg-pink-100 text-pink-700',
  agreement: 'bg-orange-100 text-orange-700',
  general: 'bg-slate-100 text-slate-700',
  other: 'bg-slate-100 text-slate-600',
};

function DocTypeIcon({ type }: { type: string }) {
  if (type === 'photo') return <Image className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCustomerLabel(doc: AdminDocument): string {
  const c = doc.customer;
  if (!c) return doc.owner_customer_id.slice(0, 8) + '…';
  return c.full_name ?? c.email ?? c.phone ?? 'Unknown';
}

export default function AdminDocumentsPage() {
  const { currentOrganization } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AdminDocumentType | 'all'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden' | 'internal'>('all');
  const [customerFilter, setCustomerFilter] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [preselectedCustomer, setPreselectedCustomer] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AdminDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const organizationId = currentOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    loadData();
  }, [organizationId]);

  async function loadData() {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [docs, custs] = await Promise.all([
        getDocumentsForAdmin(organizationId),
        getCustomersForOrg(organizationId),
      ]);
      setDocuments(docs);
      setCustomers(custs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const customerLabel = getCustomerLabel(doc).toLowerCase();
        const match =
          doc.display_name.toLowerCase().includes(q) ||
          customerLabel.includes(q) ||
          doc.document_type.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (typeFilter !== 'all' && doc.document_type !== typeFilter) return false;
      if (customerFilter && doc.owner_customer_id !== customerFilter) return false;
      if (visibilityFilter === 'visible' && (!doc.is_visible_to_customer || doc.is_internal_only)) return false;
      if (visibilityFilter === 'hidden' && (doc.is_visible_to_customer || doc.is_internal_only)) return false;
      if (visibilityFilter === 'internal' && !doc.is_internal_only) return false;
      return true;
    });
  }, [documents, searchQuery, typeFilter, visibilityFilter, customerFilter]);

  const handleToggleVisibility = async (doc: AdminDocument) => {
    setTogglingId(doc.id);
    try {
      const next = !doc.is_visible_to_customer;
      await toggleDocumentVisibility(doc.id, next);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_visible_to_customer: next } : d))
      );
      showToast({
        message: next ? 'Document is now visible to customer.' : 'Document hidden from customer.',
        type: 'success',
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Update failed.', type: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await softDeleteDocument(confirmDelete.id, confirmDelete.storage_path);
      setDocuments((prev) => prev.filter((d) => d.id !== confirmDelete.id));
      showToast({ message: 'Document deleted.', type: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Delete failed.', type: 'error' });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleDownload = async (doc: AdminDocument) => {
    setDownloadingId(doc.id);
    try {
      const url = await getAdminDocumentSignedUrl(doc.storage_path, true);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Download failed.', type: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = async (doc: AdminDocument) => {
    setDownloadingId(doc.id);
    try {
      const url = await getAdminDocumentSignedUrl(doc.storage_path, false);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Could not open document.', type: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const hasActiveFilters = searchQuery || typeFilter !== 'all' || visibilityFilter !== 'all' || customerFilter;

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setVisibilityFilter('all');
    setCustomerFilter('');
  };

  const stats = useMemo(() => {
    const total = documents.length;
    const visible = documents.filter((d) => d.is_visible_to_customer && !d.is_internal_only).length;
    const internal = documents.filter((d) => d.is_internal_only).length;
    const hidden = documents.filter((d) => !d.is_visible_to_customer && !d.is_internal_only).length;
    return { total, visible, internal, hidden };
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Documents</h1>
          <p className="text-sm text-slate-500 mt-1">Upload and manage files in customer secure vaults</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slateald-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setPreselectedCustomer(null); setShowUploadModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Documents', value: stats.total, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Visible to Customers', value: stats.visible, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Hidden', value: stats.hidden, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Internal Only', value: stats.internal, color: 'text-slate-600', bg: 'bg-slate-100' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl border border-slate-200 px-4 py-3`}>
            <p className="text-xs text-slate-500 mb-0.5">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, customer, type..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Customer filter */}
          <div className="relative">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.email ?? 'Unknown'}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AdminDocumentType | 'all')}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="all">All Types</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Visibility filter */}
          <div className="relative">
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="all">All Visibility</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="internal">Internal Only</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            {hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Upload a document to add it to a customer\'s vault.'}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filteredDocuments.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{documents.length}</span> documents
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const typeLabel = DOCUMENT_TYPE_LABELS[doc.document_type as AdminDocumentType] ?? doc.document_type;
                  const typeColor = TYPE_COLORS[doc.document_type as AdminDocumentType] ?? 'bg-slate-100 text-slate-600';
                  const isProcessing = togglingId === doc.id || deletingId === doc.id || downloadingId === doc.id;

                  return (
                    <tr key={doc.id} className={`hover:bg-slate-50/50 transition-colors ${isProcessing ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <DocTypeIcon type={doc.document_type} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{doc.display_name}</p>
                            {(doc.related_job_id || doc.related_invoice_id) && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {doc.related_invoice?.invoice_number
                                  ? `Invoice #${doc.related_invoice.invoice_number}`
                                  : null}
                                {doc.related_job?.job_type
                                  ? (doc.related_invoice?.invoice_number ? ' · ' : '') +
                                    doc.related_job.job_type +
                                    (doc.related_job.date_scheduled
                                      ? ` (${new Date(doc.related_job.date_scheduled).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`
                                      : '')
                                  : null}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">{getCustomerLabel(doc)}</p>
                        {doc.customer?.email && (
                          <p className="text-xs text-slate-400">{doc.customer.email}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {doc.is_internal_only ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2.5 py-0.5">
                            <Lock className="w-3 h-3" />
                            Internal
                          </span>
                        ) : doc.is_visible_to_customer ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5">
                            <Eye className="w-3 h-3" />
                            Visible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">
                            <EyeOff className="w-3 h-3" />
                            Hidden
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">{formatDate(doc.created_at)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">{formatDate(doc.delete_after_at)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleView(doc)}
                            disabled={isProcessing}
                            title="View document"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={isProcessing}
                            title="Download document"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {!doc.is_internal_only && (
                            <button
                              onClick={() => handleToggleVisibility(doc)}
                              disabled={isProcessing}
                              title={doc.is_visible_to_customer ? 'Hide from customer' : 'Show to customer'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                doc.is_visible_to_customer
                                  ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              {doc.is_visible_to_customer ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          )}

                          <button
                            onClick={() => setConfirmDelete(doc)}
                            disabled={isProcessing}
                            title="Delete document"
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <AdminDocumentUploadModal
          customers={customers}
          preselectedCustomerId={preselectedCustomer}
          onClose={() => { setShowUploadModal(false); setPreselectedCustomer(null); }}
          onSuccess={() => { setShowUploadModal(false); setPreselectedCustomer(null); loadData(); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmActionModal
          isOpen={!!confirmDelete}
          title="Delete Document"
          description={`Are you sure you want to delete "${confirmDelete.display_name}"? This will remove the file from storage and cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isLoading={deletingId === confirmDelete.id}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          destructive
        />
      )}
    </div>
  );
}
