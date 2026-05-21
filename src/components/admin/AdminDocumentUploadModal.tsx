import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, File, AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff, Lock } from 'lucide-react';
import {
  uploadDocumentForCustomer,
  getJobsForCustomer,
  getInvoicesForCustomer,
  type AdminDocumentType,
  type CustomerOption,
  type JobOption,
  type InvoiceOption,
} from '../../services/adminDocumentService';
import { useAuth } from '../../contexts/AuthContext';

const DOCUMENT_TYPES: { value: AdminDocumentType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'job_report', label: 'Job Report' },
  { value: 'photo', label: 'Photo' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

const STANDALONE_TYPES: AdminDocumentType[] = ['general', 'agreement', 'other'];

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  customers: CustomerOption[];
  preselectedCustomerId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminDocumentUploadModal({
  customers,
  preselectedCustomerId,
  onClose,
  onSuccess,
}: Props) {
  const { currentOrganization } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId ?? '');
  const [documentType, setDocumentType] = useState<AdminDocumentType>('general');
  const [displayName, setDisplayName] = useState('');
  const [relatedJobId, setRelatedJobId] = useState('');
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [isInternalOnly, setIsInternalOnly] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!selectedCustomerId) {
      setJobs([]);
      setInvoices([]);
      return;
    }
    setLoadingRelated(true);
    Promise.all([
      getJobsForCustomer(selectedCustomerId),
      getInvoicesForCustomer(selectedCustomerId),
    ])
      .then(([j, i]) => {
        setJobs(j);
        setInvoices(i);
      })
      .catch(() => {})
      .finally(() => setLoadingRelated(false));
  }, [selectedCustomerId]);

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
      return `File type "${f.type || 'unknown'}" is not supported. Please upload a PDF, image, Word document, Excel file, or text file.`;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large (${formatBytes(f.size)}). Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
    if (!displayName) {
      setDisplayName(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    }
  }, [validateFile, displayName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, [handleFileSelect]);

  const needsRelated = !STANDALONE_TYPES.includes(documentType);

  const isFormValid =
    selectedCustomerId &&
    documentType &&
    displayName.trim() &&
    file &&
    !fileError &&
    (!needsRelated || relatedJobId || relatedInvoiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !currentOrganization || !file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 12, 85));
    }, 200);

    try {
      await uploadDocumentForCustomer({
        organizationId: currentOrganization.id,
        ownerCustomerId: selectedCustomerId,
        documentType,
        displayName: displayName.trim(),
        relatedJobId: relatedJobId || null,
        relatedInvoiceId: relatedInvoiceId || null,
        isVisibleToCustomer: isVisible && !isInternalOnly,
        isInternalOnly,
        file,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess(true);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-dvh sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Upload className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Upload Document</h2>
              <p className="text-xs text-slate-500 mt-0.5">Add a file to a customer's secure vault</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Customer selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setRelatedJobId('');
                  setRelatedInvoiceId('');
                }}
                disabled={uploading || !!preselectedCustomerId}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name ?? 'Unknown'} {c.email ? `– ${c.email}` : ''} {c.phone ? `– ${c.phone}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {selectedCustomer && (
              <p className="mt-1.5 text-xs text-emerald-700 font-medium">
                Uploading to: {selectedCustomer.full_name ?? 'Unknown'}'s vault
              </p>
            )}
          </div>

          {/* Document type & display name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Document Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value as AdminDocumentType);
                    setRelatedJobId('');
                    setRelatedInvoiceId('');
                  }}
                  disabled={uploading}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={uploading}
                placeholder="e.g. Final Invoice #1042"
                maxLength={200}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Related job / invoice (conditional) */}
          {selectedCustomerId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Related Job {needsRelated && !relatedInvoiceId && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <select
                    value={relatedJobId}
                    onChange={(e) => setRelatedJobId(e.target.value)}
                    disabled={uploading || loadingRelated}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                  >
                    <option value="">None</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.job_type ?? 'Job'} {j.date_scheduled ? `– ${new Date(j.date_scheduled).toLocaleDateString()}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Related Invoice {needsRelated && !relatedJobId && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <select
                    value={relatedInvoiceId}
                    onChange={(e) => setRelatedInvoiceId(e.target.value)}
                    disabled={uploading || loadingRelated}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
                  >
                    <option value="">None</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        #{inv.invoice_number} – ${inv.total_amount.toFixed(2)} ({inv.status})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {needsRelated && selectedCustomerId && !relatedJobId && !relatedInvoiceId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              A related job or invoice is required for this document type.
            </p>
          )}

          {/* Visibility controls */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsVisible(!isVisible);
                if (!isVisible) setIsInternalOnly(false);
              }}
              disabled={uploading || isInternalOnly}
              className={`flex-1 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                isVisible && !isInternalOnly
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              } disabled:opacity-50`}
            >
              <Eye className="w-4 h-4 flex-shrink-0" />
              <div className="text-left">
                <div>Visible to customer</div>
                <div className="text-xs font-normal opacity-70">Customer can see this in portal</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsInternalOnly(!isInternalOnly);
                if (!isInternalOnly) setIsVisible(false);
              }}
              disabled={uploading}
              className={`flex-1 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                isInternalOnly
                  ? 'border-slate-400 bg-slate-100 text-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Lock className="w-4 h-4 flex-shrink-0" />
              <div className="text-left">
                <div>Internal only</div>
                <div className="text-xs font-normal opacity-70">Hidden from customer portal</div>
              </div>
            </button>
          </div>

          {/* Drop zone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              File <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-slate-500">(max {MAX_FILE_SIZE_MB} MB)</span>
            </label>
            <div
              ref={dropZoneRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : fileError
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/30'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = '';
                }}
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <File className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Drop a file here or <span className="text-emerald-600">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      PDF, images, Word, Excel, CSV, TXT — up to {MAX_FILE_SIZE_MB} MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {fileError && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {fileError}
              </p>
            )}
          </div>

          {/* Upload progress */}
          {uploading && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-slate-700">Uploading...</p>
                <p className="text-xs text-slate-500">{uploadProgress}%</p>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800">Document uploaded successfully!</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <p className="text-xs text-slate-500">
            Files are stored in a secure, encrypted vault
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="upload-form"
              onClick={handleSubmit}
              disabled={!isFormValid || uploading || success}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
