import React, { useState, useEffect, useRef } from 'react';
import { supabase, Job, ServiceArea, PaymentMethod } from '../../lib/supabase';
import { X, Save, DollarSign, TrendingUp, Bold, Italic, List, Link as LinkIcon, Gift, MapPin } from 'lucide-react';
import { REFERRAL_SOURCES, calculateNetProfit, calculateHourlyRate, formatCurrency } from '../../utils/jobCalculations';
import { getDirectionsUrl, isSameAddress, normalizeAddress } from '../../utils/jobAddress';

interface LinkedClient {
  id: string;
  name: string;
  address: string | null;
}

type WorkLocationMode = 'same' | 'different';

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
  const [linkedClient, setLinkedClient] = useState<LinkedClient | null>(null);
  const [workLocationMode, setWorkLocationMode] = useState<WorkLocationMode>('same');
  const [serviceAddressDraft, setServiceAddressDraft] = useState('');

  const [formData, setFormData] = useState<Partial<Job>>({
    client_name: '',
    client_phone: '',
    client_email: '',
    client_address: '',
    service_address: null,
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
    is_free: false,
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
      applyWorkLocationFrom(job);
    } else if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
      applyWorkLocationFrom(initialData);
    }
  }, [job, initialData, businessId]);

  // The client profile attached to the job is the source of truth for the customer address.
  useEffect(() => {
    if (!job?.client_id) return;

    let cancelled = false;

    supabase
      .from('clients')
      .select('id, name, address')
      .eq('id', job.client_id)
      .maybeSingle()
      .then(({ data, error: clientError }) => {
        if (cancelled) return;
        if (clientError) {
          console.error('Error fetching client profile for job:', clientError);
          return;
        }
        if (data) setLinkedClient(data as LinkedClient);
      });

    return () => {
      cancelled = true;
    };
  }, [job?.client_id]);

  // New jobs aren't linked to a client yet, so match on what has been typed so far and
  // carry that profile's address over. Saving re-runs the same matching in the database.
  useEffect(() => {
    if (job?.client_id || !organizationId) return;

    const email = formData.client_email?.trim() || '';
    const phone = formData.client_phone?.trim() || '';

    if (!email && !phone) {
      setLinkedClient(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const match = await findClientByContact(organizationId, email, phone);
      if (cancelled) return;

      setLinkedClient(match);

      const profileAddress = normalizeAddress(match?.address);
      if (profileAddress) {
        setFormData(prev => (normalizeAddress(prev.client_address) ? prev : { ...prev, client_address: profileAddress }));
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.client_email, formData.client_phone, organizationId, job?.client_id]);

  const applyWorkLocationFrom = (source: Partial<Job>) => {
    const serviceAddress = normalizeAddress(source.service_address);
    setWorkLocationMode(serviceAddress ? 'different' : 'same');
    setServiceAddressDraft(serviceAddress || '');
  };

  const findClientByContact = async (
    orgId: string,
    email: string,
    phone: string
  ): Promise<LinkedClient | null> => {
    try {
      if (email) {
        // Escape LIKE wildcards so a literal _ or % can't match the wrong profile.
        const emailPattern = email.replace(/[%_\\]/g, (char) => `\\${char}`);
        const { data } = await supabase
          .from('clients')
          .select('id, name, address')
          .eq('organization_id', orgId)
          .ilike('email', emailPattern)
          .limit(1)
          .maybeSingle();

        if (data) return data as LinkedClient;
      }

      if (phone) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, address')
          .eq('organization_id', orgId)
          .eq('phone', phone)
          .limit(1)
          .maybeSingle();

        if (data) return data as LinkedClient;
      }
    } catch (err) {
      console.error('Error looking up client profile:', err);
    }

    return null;
  };

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

  // "Same as client address" is stored as a null service address so the work location keeps
  // following the client profile instead of holding a copy that goes stale.
  const buildJobPayload = (): Partial<Job> => ({
    ...formData,
    client_address: normalizeAddress(formData.client_address),
    service_address: workLocationMode === 'different' ? normalizeAddress(serviceAddressDraft) : null,
  });

  const buildNewJobPayload = async () => {
    // Merge-safe behavior: always include business_id, and include organization_id when it can be resolved.
    const resolvedOrganizationId = organizationId ?? await fetchOrganizationId();

    return {
      ...buildJobPayload(),
      business_id: businessId,
      ...(resolvedOrganizationId ? { organization_id: resolvedOrganizationId } : {}),
    };
  };

  const handleSave = async () => {
    const requiresHoursWorked = formData.job_status === 'completed' || Boolean(formData.date_completed);
    const hasValidHoursWorked = typeof formData.hours_worked === 'number' && formData.hours_worked > 0;

    if (!formData.client_name?.trim()) {
      setError('Client name is required');
      return;
    }

    if (requiresHoursWorked && !hasValidHoursWorked) {
      setError('Hours worked is required and must be greater than 0 when a job is completed.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (job) {
        const payload = buildJobPayload();
        // Read the row back so address syncing done by the database (client profile pulled in,
        // "same as client" collapsed to null) is what the caller sees.
        const { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .update(payload)
          .eq('id', job.id)
          .select()
          .maybeSingle();

        if (updateError) throw updateError;
        onSave((updatedJob as Job) ?? ({ ...job, ...payload } as Job));
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

  const clientAddress = normalizeAddress(formData.client_address);
  const profileAddress = normalizeAddress(linkedClient?.address);
  const canPullProfileAddress = Boolean(profileAddress && !isSameAddress(profileAddress, clientAddress));
  const workAddress = workLocationMode === 'different' ? normalizeAddress(serviceAddressDraft) : clientAddress;

  const selectWorkLocationMode = (mode: WorkLocationMode) => {
    setWorkLocationMode(mode);
    // Start a different work address from the client's, so only the parts that differ need editing.
    if (mode === 'different' && !serviceAddressDraft.trim() && clientAddress) {
      setServiceAddressDraft(clientAddress);
    }
  };

  const isFree = formData.is_free === true;
  const netProfit = isFree ? 0 : calculateNetProfit(formData.final_price ?? null, formData.materials_cost ?? null);
  const hourlyRate = isFree ? 0 : calculateHourlyRate(formData.final_price ?? null, formData.materials_cost ?? null, formData.hours_worked ?? null);
  const requiresHoursWorked = formData.job_status === 'completed' || Boolean(formData.date_completed);

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
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-w-4xl w-full max-h-dvh sm:max-h-[90vh] overflow-y-auto">
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
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Client Address</label>
                <input name="client_address"
                  type="text"
                  value={formData.client_address || ''}
                  onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                  placeholder="123 Main St, Franklin, TN 37064"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {canPullProfileAddress ? (
                    <>
                      <p className="text-xs text-amber-700">
                        {linkedClient?.name ? `${linkedClient.name}'s` : 'The'} client profile has{' '}
                        <span className="font-medium">{profileAddress}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, client_address: profileAddress })}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
                      >
                        Use profile address
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {linkedClient
                        ? `Shared with ${linkedClient.name}'s client profile — saving here updates the profile too.`
                        : 'Saved to the matching client profile when this job is linked to a client.'}
                    </p>
                  )}
                </div>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFree}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setFormData({
                            ...formData,
                            is_free: true,
                            quoted_price: null,
                            final_price: null,
                            materials_cost: null,
                            payment_method: '',
                            payment_date: null,
                            job_status: formData.job_status === 'quoted' ? 'accepted' : formData.job_status,
                          });
                        } else {
                          setFormData({ ...formData, is_free: false });
                        }
                      }}
                      className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-cyan-700 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      Free Job
                    </span>
                  </label>
                </div>
                <select name="job_status"
                  value={formData.job_status || 'quoted'}
                  onChange={(e) => setFormData({ ...formData, job_status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {!isFree && <option value="quoted">Quoted</option>}
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
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Work Location</h3>
            <p className="text-sm text-slate-500 mb-4">Where the work takes place.</p>
            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  workLocationMode === 'same' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input name="work_location_mode"
                  type="radio"
                  checked={workLocationMode === 'same'}
                  onChange={() => selectWorkLocationMode('same')}
                  className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">Same as client address</span>
                  <span className="block text-xs text-slate-500 mt-0.5 break-words">
                    {clientAddress || 'Add a client address above to use this option.'}
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  workLocationMode === 'different' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input name="work_location_mode"
                  type="radio"
                  checked={workLocationMode === 'different'}
                  onChange={() => selectWorkLocationMode('different')}
                  className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">A different address</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Storage unit, office, second property, or anywhere else the work happens.
                  </span>
                </span>
              </label>

              {workLocationMode === 'different' && (
                <div className="space-y-2">
                  <textarea name="service_address"
                    value={serviceAddressDraft}
                    onChange={(e) => setServiceAddressDraft(e.target.value)}
                    rows={2}
                    placeholder="456 Oak Ave, Spring Hill, TN 37174"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {clientAddress && !isSameAddress(clientAddress, serviceAddressDraft) && (
                    <button
                      type="button"
                      onClick={() => setServiceAddressDraft(clientAddress)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
                    >
                      Copy client address
                    </button>
                  )}
                </div>
              )}

              {workAddress && (
                <a
                  href={getDirectionsUrl(workAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <MapPin className="w-4 h-4" />
                  Open directions
                </a>
              )}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hours Worked
                  {requiresHoursWorked && <span className="text-red-500"> *</span>}
                </label>
                <input name="hours_worked"
                  type="number"
                  step="0.01"
                  min={requiresHoursWorked ? '0.01' : '0'}
                  value={formData.hours_worked || ''}
                  onChange={(e) => setFormData({ ...formData, hours_worked: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required={requiresHoursWorked}
                />
                {requiresHoursWorked && (
                  <p className="mt-1 text-xs text-amber-700">
                    Required when status is completed or a completion date is set.
                  </p>
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isFree ? 'text-slate-400' : 'text-slate-700'}`}>Quoted Price</label>
                <input name="quoted_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={isFree ? '' : (formData.quoted_price || '')}
                  onChange={(e) => setFormData({ ...formData, quoted_price: parseFloat(e.target.value) || null })}
                  disabled={isFree}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isFree ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isFree ? 'text-slate-400' : 'text-slate-700'}`}>Final Price</label>
                <input name="final_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={isFree ? '' : (formData.final_price || '')}
                  onChange={(e) => setFormData({ ...formData, final_price: parseFloat(e.target.value) || null })}
                  disabled={isFree}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isFree ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isFree ? 'text-slate-400' : 'text-slate-700'}`}>Materials/Extras Cost</label>
                <input name="materials_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={isFree ? '' : (formData.materials_cost || '')}
                  onChange={(e) => setFormData({ ...formData, materials_cost: parseFloat(e.target.value) || null })}
                  disabled={isFree}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isFree ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
                />
              </div>
            </div>

            {isFree ? (
              <div className="mt-4 bg-cyan-50 border border-cyan-200 rounded-lg p-4 flex items-center gap-3">
                <Gift className="w-5 h-5 text-cyan-600" />
                <p className="text-sm font-medium text-cyan-800">Free Job -- no financial tracking. Hours worked will still be recorded.</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-900">Net Profit</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(netProfit)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-900">Hourly Rate</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(hourlyRate)}/hr</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment & Follow-up</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isFree ? 'text-slate-400' : 'text-slate-700'}`}>Payment Method</label>
                <select name="payment_method"
                  value={isFree ? '' : (formData.payment_method || '')}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  disabled={isFree}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isFree ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
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
                <label className={`block text-sm font-medium mb-2 ${isFree ? 'text-slate-400' : 'text-slate-700'}`}>Payment Date</label>
                <input name="payment_date"
                  type="date"
                  value={isFree ? '' : (formData.payment_date || '')}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  disabled={isFree}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${isFree ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-300'}`}
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
