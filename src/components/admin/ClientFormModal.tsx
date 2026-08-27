import { useRef, useState } from 'react';
import { X, UserPlus, Sparkles, Upload, AlertCircle, Check, Trash2 } from 'lucide-react';
import {
  createClientRecord,
  createClientNote,
  type Client,
  type ClientStatus,
  type ClientValueTier,
} from '../../services/clientService';
import { analyzeClientPhoto, formatExtractedPhone, type ExtractionConfidence } from '../../services/clientAIService';
import {
  optimizeImage,
  validateImageFile,
  snapshotFileToMemory,
  normalizeImageFile,
} from '../../utils/imageOptimizationUpload';
import { REFERRAL_SOURCES } from '../../utils/jobCalculations';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../services/auditLogService';

interface ClientFormModalProps {
  organizationId: string;
  onClose: () => void;
  onCreated: (client: Client, warning?: string) => void;
  /**
   * Prefills the contact fields when the form is opened from somewhere that
   * already knows part of the answer — the client search on a job, say.
   */
  initialValues?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'dormant', label: 'Dormant' },
];

const TIER_OPTIONS: { value: ClientValueTier; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'high_value', label: 'High Value' },
  { value: 'vip', label: 'VIP' },
];

const CONFIDENCE_STYLES: Record<ExtractionConfidence, string> = {
  high: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-orange-100 text-orange-800',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  source: 'Source',
  notes: 'Note',
};

interface ScanResult {
  filledFields: string[];
  confidence: ExtractionConfidence;
  warnings: string[];
}

export default function ClientFormModal({ organizationId, onClose, onCreated, initialValues }: ClientFormModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: initialValues?.name ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    address: initialValues?.address ?? '',
    client_status: 'lead' as ClientStatus,
    client_value_tier: 'standard' as ClientValueTier,
    source: '',
    tags: '',
    marketing_email_opt_in: true,
    is_test: false,
    note: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hint, setHint] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleClose() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setScanResult(null);
    setScanError(null);
    setHint('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setScanError(validation.error!);
      return;
    }

    try {
      // Copy the bytes into memory now so a later read can't hit
      // net::ERR_UPLOAD_FILE_CHANGED when an OS-backed temp file goes stale on
      // mobile, and convert HEIC/HEIF so the preview and canvas work everywhere.
      const normalized = await normalizeImageFile(await snapshotFileToMemory(file));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(normalized);
      setPreviewUrl(URL.createObjectURL(normalized));
      setScanResult(null);
      setScanError(null);
    } catch (err) {
      console.error('Error reading selected image:', err);
      setScanError('Could not read that image. Please try selecting it again.');
    }
  }

  async function handleScan() {
    if (!selectedFile) return;

    try {
      setAnalyzing(true);
      setScanError(null);

      // Downscale before sending. 1568px is the vision API's recommended long-edge
      // max — a full-res phone photo is slower, costlier, and can exceed the
      // per-image size limit with no gain in what the model can read.
      const optimized = await optimizeImage(selectedFile, {
        maxWidth: 1568,
        maxHeight: 1568,
        quality: 0.8,
        convertToWebP: false,
      });

      const extraction = await analyzeClientPhoto(optimized.file, hint);
      const phone = formatExtractedPhone(extraction.phone);

      // Only fill fields the photo actually answered, and never overwrite
      // something the admin already typed.
      const candidates: [keyof typeof formData, string][] = [
        ['name', extraction.name || ''],
        ['email', extraction.email || ''],
        ['phone', phone],
        ['address', extraction.address || ''],
        ['source', extraction.source || ''],
        ['note', extraction.notes || ''],
      ];

      const fills = candidates.filter(
        ([field, value]) => value && !String(formData[field]).trim()
      );
      const filledFields = fills.map(([field]) => (field === 'note' ? 'notes' : field));

      setFormData((prev) => ({
        ...prev,
        ...Object.fromEntries(fills),
      }));

      setScanResult({
        filledFields,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
      });
    } catch (err) {
      console.error('Client photo scan error:', err);
      setScanError(err instanceof Error ? err.message : 'Photo scan failed');
      setScanResult(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function validate(): string | null {
    if (!formData.name.trim()) return 'Client name is required.';
    if (!formData.email.trim() && !formData.phone.trim()) {
      return 'Add an email address or a phone number — a client record needs at least one.';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'That email address does not look valid.';
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const client = await createClientRecord(organizationId, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        client_status: formData.client_status,
        client_value_tier: formData.client_value_tier,
        source: formData.source.trim() || null,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        marketing_email_opt_in: formData.marketing_email_opt_in,
        is_test: formData.is_test,
      });

      // The client row is already saved at this point, so a failed note is
      // reported rather than rolled back — the admin can re-add it from the
      // client's record.
      let warning: string | undefined;
      if (formData.note.trim()) {
        try {
          if (!user?.id) throw new Error('No signed-in user to attribute the note to');
          await createClientNote(client.id, organizationId, formData.note.trim(), user.id);
        } catch (noteError) {
          console.error('Client created but the note could not be saved:', noteError);
          warning = 'The internal note could not be saved — add it from their record.';
        }
      }

      logAction({ actionType: 'CREATE', tableName: 'clients', recordIdentifier: client.name });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onCreated(client, warning);
    } catch (err) {
      console.error('Error creating client:', err);
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : '';

      if (code === '23505' || /unique|duplicate/i.test(message)) {
        setError(
          'A client with this email already exists. Search for them on the Clients page, or use Merge to combine duplicate records.'
        );
      } else if (code === '23514') {
        setError('A client record needs at least an email address or a phone number.');
      } else {
        setError(message || 'Failed to create the client. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm';

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-dvh sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Add Client
          </h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Photo scan — optional shortcut that fills the form below */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Fill from a photo
                  <span className="text-slate-400 font-normal">(optional)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Business card, handwritten note, work order, or a screenshot of a text or email.
                  Everything it reads lands in the form below, where you can correct it.
                </p>
              </div>
            </div>

            {!previewUrl ? (
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-lg px-4 py-6 text-center transition-colors ${
                  isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-white'
                }`}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-600 mb-3">Drag a photo here, or</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Choose Photo
                </button>
                <p className="text-xs text-slate-400 mt-3">JPEG, PNG, HEIC, or WebP — up to 50MB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={previewUrl}
                    alt="Selected client photo"
                    className="w-24 h-24 object-contain bg-white rounded-lg border border-slate-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Anything to add? <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) => setHint(e.target.value)}
                      disabled={analyzing}
                      className={inputClasses}
                      placeholder="e.g. the customer is the name on the left"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={analyzing || saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-50 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700" />
                        Reading photo...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {scanResult ? 'Scan Again' : 'Scan Photo'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    disabled={analyzing || saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />

            {scanError && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {scanResult && (
              <div className="mt-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      {scanResult.filledFields.length > 0 ? (
                        <span>
                          Filled in{' '}
                          {scanResult.filledFields
                            .map((field) => FIELD_LABELS[field] ?? field)
                            .join(', ')}
                          . Check it over before saving.
                        </span>
                      ) : (
                        <span>
                          Everything readable was already filled in — nothing was overwritten.
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONFIDENCE_STYLES[scanResult.confidence]}`}
                      >
                        {scanResult.confidence} confidence
                      </span>
                    </p>
                    {scanResult.warnings.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-xs text-emerald-900/80">
                        {scanResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Client details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Client details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={inputClasses}
                  placeholder="Full name or business name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={inputClasses}
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  onBlur={(e) => updateField('phone', formatExtractedPhone(e.target.value))}
                  className={inputClasses}
                  placeholder="(555) 555-5555"
                />
              </div>

              <p className="md:col-span-2 -mt-2 text-xs text-slate-500">
                An email address or a phone number is required — either one is enough.
              </p>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className={inputClasses}
                  placeholder="123 Main St, Spring Hill, TN 37174"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={formData.client_status}
                  onChange={(e) => updateField('client_status', e.target.value as ClientStatus)}
                  className={inputClasses}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Value Tier</label>
                <select
                  value={formData.client_value_tier}
                  onChange={(e) => updateField('client_value_tier', e.target.value as ClientValueTier)}
                  className={inputClasses}
                >
                  {TIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Recalculated from revenue on the next metrics refresh.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
                <input
                  type="text"
                  list="client-source-options"
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value)}
                  className={inputClasses}
                  placeholder="How did they find you?"
                />
                <datalist id="client-source-options">
                  {REFERRAL_SOURCES.map((source) => (
                    <option key={source} value={source} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  className={inputClasses}
                  placeholder="Comma separated, e.g. nursery, repeat"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Internal Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => updateField('note', e.target.value)}
                  rows={3}
                  className={inputClasses}
                  placeholder="Job details, access instructions, anything worth remembering"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Saved as the first note on the client's record. Never shown to the client.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.marketing_email_opt_in}
                  onChange={(e) => updateField('marketing_email_opt_in', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Opted in to marketing emails
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_test}
                  onChange={(e) => updateField('is_test', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Test record — keep out of stats and marketing lists
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || analyzing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Creating...' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
