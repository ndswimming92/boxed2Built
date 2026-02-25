import React, { useState, useEffect, useRef } from 'react';
import { supabase, Job, ServiceArea, PaymentMethod } from '../../lib/supabase';
import { X, Save, DollarSign, TrendingUp, Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import { REFERRAL_SOURCES, calculateNetProfit, calculateHourlyRate, formatCurrency } from '../../utils/jobCalculations';

interface JobFormModalProps {
  job: Job | null;
  businessId: string;
  onClose: () => void;
  onSave: (savedJob?: Job) => void;
  initialData?: Partial<Job>;
  title?: string;
}

export default function JobFormModal({ job, businessId, onClose, onSave, initialData, title }: JobFormModalProps) {
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [jobTypeOptions, setJobTypeOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Job>>({
    client_name: '',
    client_phone: '',
    client_email: '',
    job_type: '',
    job_description: '',
    date_quoted: null,
    date_scheduled: null,
    date_completed: null,
    hours_worked: null,
    quoted_price: null,
    final_price: null,
    materials_cost: 0,
    location_city: '',
    payment_method: '',
    payment_date: null,
    reviews_received: false,
    google_review_link_sent: false,
    repeat_client: false,
    referral_source: '',
    notes: '',
    job_status: 'quoted',
  });

  useEffect(() => {
    fetchDropdownData();

    fetchOrganizationId()
      .then((orgId) => setOrganizationId(orgId))
      .catch((err) => {
        console.error('Error fetching business organization:', err);
      });

    if (job) {
      setFormData(job);
    } else if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [job, initialData, businessId]);

  const fetchDropdownData = async () => {
    try {
      const [areasRes, paymentsRes, jobTypesRes] = await Promise.all([
        supabase.from('service_areas').select('*').eq('is_active', true).order('city_name'),
        supabase.from('payment_methods').select('*').eq('business_id', businessId).eq('is_active', true).order('display_order'),
        supabase
          .from('jobs')
          .select('job_type')
          .eq('business_id', businessId)
          .not('job_type', 'is', null)
      ]);

      if (areasRes.data) setServiceAreas(areasRes.data);
      if (paymentsRes.data) setPaymentMethods(paymentsRes.data);

      if (jobTypesRes.data) {
        const jobTypes = Array.from(
          new Set(
            jobTypesRes.data
              .map(({ job_type }) => job_type?.trim())
              .filter((jobType): jobType is string => Boolean(jobType))
          )
        ).sort((a, b) => a.localeCompare(b));

        setJobTypeOptions(jobTypes);
      }
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  const fetchOrganizationId = async (): Promise<string | null> => {
    const { data: businessData, error: businessError } = await supabase
      .from('business_info')
      .select('organization_id')
      .eq('id', businessId)
      .maybeSingle();

    if (businessError) {
      throw businessError;
    }

    if (businessData?.organization_id) {
      return businessData.organization_id;
    }

    // Fallback for single-org environments where business_info.organization_id may be unset.
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (orgError) {
      throw orgError;
    }

    return orgData?.id ?? null;
  };

  const buildNewJobPayload = async () => {
    // Merge-safe behavior: always include business_id, and include organization_id when it can be resolved.
    const resolvedOrganizationId = organizationId ?? await fetchOrganizationId();

    return {
      ...formData,
      business_id: businessId,
      ...(resolvedOrganizationId ? { organization_id: resolvedOrganizationId } : {}),
    };
  };

  const handleSave = async () => {
    if (!formData.client_name?.trim()) {
      setError('Client name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (job) {
        const { error: updateError } = await supabase
          .from('jobs')
          .update(formData)
          .eq('id', job.id);

        if (updateError) throw updateError;
        onSave({ ...job, ...formData } as Job);
      } else {
        const newJobPayload = await buildNewJobPayload();
        if (newJobPayload.organization_id && !organizationId) {
          setOrganizationId(newJobPayload.organization_id);
        }

        const { data: newJob, error: insertError } = await supabase
          .from('jobs')
          .insert([newJobPayload])
          .select()
          .single();

        if (insertError) throw insertError;
        onSave(newJob as Job);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving job:', err);
      if (err?.message?.includes('organization_id') && err?.message?.includes('null value')) {
        setError('Unable to create job because organization context is missing. Please refresh and try again.');
      } else {
        setError(err.message || 'Failed to save job');
      }
    } finally {
      setSaving(false);
    }
  };

  const currentJobType = formData.job_type?.trim() || '';
  const availableJobTypes = currentJobType && !jobTypeOptions.includes(currentJobType)
    ? [currentJobType, ...jobTypeOptions]
    : jobTypeOptions;

  const netProfit = calculateNetProfit(formData.final_price, formData.materials_cost);
  const hourlyRate = calculateHourlyRate(formData.final_price, formData.materials_cost, formData.hours_worked);

  const updateNotes = (nextValue: string) => {
    setFormData({ ...formData, notes: nextValue });
  };

  const applyNotesFormat = (mode: 'bold' | 'italic' | 'list' | 'link') => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;

    const value = formData.notes || '';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    let replacement = selectedText;

    if (mode === 'bold') {
      replacement = `**${selectedText || 'bold text'}**`;
    }

    if (mode === 'italic') {
      replacement = `*${selectedText || 'italic text'}*`;
    }

    if (mode === 'list') {
      replacement = selectedText
        ? selectedText
            .split('\n')
            .map((line) => (line.trim() ? `- ${line}` : line))
            .join('\n')
        : '- List item';
    }

    if (mode === 'link') {
      const selected = selectedText.trim();
      replacement = selected.startsWith('http://') || selected.startsWith('https://')
        ? `[${selected}](${selected})`
        : `[${selected || 'Link text'}](https://)`;
    }

    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    updateNotes(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + replacement.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const renderStyledText = (text: string, keyPrefix: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.filter(Boolean).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-b-${index}`}>{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={`${keyPrefix}-i-${index}`}>{part.slice(1, -1)}</em>;
      }

      return <React.Fragment key={`${keyPrefix}-t-${index}`}>{part}</React.Fragment>;
    });
  };

  const renderNotesInline = (line: string, lineIndex: number) => {
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
    const chunks: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        chunks.push(
          <React.Fragment key={`line-${lineIndex}-text-${lastIndex}`}>
            {renderStyledText(line.slice(lastIndex, match.index), `line-${lineIndex}-${lastIndex}`)}
          </React.Fragment>
        );
      }

      const label = match[1] || match[3];
      const href = match[2] || match[3];
      chunks.push(
        <a
          key={`line-${lineIndex}-link-${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 underline hover:text-emerald-800"
        >
          {label}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      chunks.push(
        <React.Fragment key={`line-${lineIndex}-tail`}>
          {renderStyledText(line.slice(lastIndex), `line-${lineIndex}-tail`)}
        </React.Fragment>
      );
    }

    return chunks;
  };

  const renderNotesPreview = (notes: string) => {
    const lines = notes.split('\n');
    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          if (line.startsWith('- ')) {
            return (
              <ul key={`line-${index}`} className="list-disc list-inside">
                <li>{renderNotesInline(line.slice(2), index)}</li>
              </ul>
            );
          }

          return <p key={`line-${index}`}>{line ? renderNotesInline(line, index) : <>&nbsp;</>}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {title || (job ? 'Edit Job' : initialData ? 'Copy Job' : 'Add New Job')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input name="client_name"
                  type="text"
                  value={formData.client_name || ''}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input name="client_phone"
                  type="tel"
                  value={formData.client_phone || ''}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input name="client_email"
                  type="email"
                  value={formData.client_email || ''}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Job Type</label>
                <select name="job_type"
                  value={formData.job_type || ''}
                  onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select job type</option>
                  {availableJobTypes.map((jobType) => (
                    <option key={jobType} value={jobType}>
                      {jobType}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Job types are based on your previously saved jobs.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                <select name="location_city"
                  value={formData.location_city || ''}
                  onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select location</option>
                  {serviceAreas.map((area) => (
                    <option key={area.id} value={area.city_name}>
                      {area.city_name}, {area.region}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select name="job_status"
                  value={formData.job_status || 'quoted'}
                  onChange={(e) => setFormData({ ...formData, job_status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="quoted">Quoted</option>
                  <option value="accepted">Accepted</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Use Mark Lost or Cancel buttons from Jobs page for lost/cancelled jobs
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Job Description</label>
              <textarea name="job_description"
                value={formData.job_description || ''}
                onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Scheduling</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date Quoted</label>
                <input name="date_quoted"
                  type="date"
                  value={formData.date_quoted || ''}
                  onChange={(e) => setFormData({ ...formData, date_quoted: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date Scheduled</label>
                <input name="date_scheduled"
                  type="date"
                  value={formData.date_scheduled || ''}
                  onChange={(e) => setFormData({ ...formData, date_scheduled: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date Completed</label>
                <input name="date_completed"
                  type="date"
                  value={formData.date_completed || ''}
                  onChange={(e) => setFormData({ ...formData, date_completed: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Financial Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hours Worked</label>
                <input name="hours_worked"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hours_worked || ''}
                  onChange={(e) => setFormData({ ...formData, hours_worked: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quoted Price</label>
                <input name="quoted_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quoted_price || ''}
                  onChange={(e) => setFormData({ ...formData, quoted_price: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Final Price</label>
                <input name="final_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.final_price || ''}
                  onChange={(e) => setFormData({ ...formData, final_price: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Materials/Extras Cost</label>
                <input name="materials_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.materials_cost || ''}
                  onChange={(e) => setFormData({ ...formData, materials_cost: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-900">Net Profit</p>
                </div>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(netProfit)}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-900">Hourly Rate</p>
                </div>
                <p className="text-2xl font-bold text-purple-700">{formatCurrency(hourlyRate)}/hr</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment & Follow-up</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select name="payment_method"
                  value={formData.payment_method || ''}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select payment method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.method_name}>
                      {method.method_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date</label>
                <input name="payment_date"
                  type="date"
                  value={formData.payment_date || ''}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Referral Source</label>
                <select name="referral_source"
                  value={formData.referral_source || ''}
                  onChange={(e) => setFormData({ ...formData, referral_source: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select source</option>
                  {REFERRAL_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2">
                  <input name="repeat_client"
                    type="checkbox"
                    checked={formData.repeat_client || false}
                    onChange={(e) => setFormData({ ...formData, repeat_client: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Repeat Client</span>
                </label>
                <label className="flex items-center gap-2">
                  <input name="google_review_link_sent"
                    type="checkbox"
                    checked={formData.google_review_link_sent || false}
                    onChange={(e) => setFormData({ ...formData, google_review_link_sent: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Google Review Sent</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Notes</h3>
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <button type="button" onClick={() => applyNotesFormat('bold')} className="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Bold">
                  <Bold className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => applyNotesFormat('italic')} className="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Italic">
                  <Italic className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => applyNotesFormat('list')} className="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Bulleted list">
                  <List className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => applyNotesFormat('link')} className="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Insert link">
                  <LinkIcon className="w-4 h-4" />
                </button>
              </div>
              <textarea
                ref={notesTextareaRef}
                name="notes"
                value={formData.notes || ''}
                onChange={(e) => updateNotes(e.target.value)}
                rows={5}
                placeholder="Any additional notes about this job..."
                className="w-full px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Supports basic formatting: **bold**, *italic*, - list items, and links.</p>
            {!!formData.notes?.trim() && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Preview</p>
                <div className="text-sm text-slate-700 break-words">
                  {renderNotesPreview(formData.notes)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Job
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
