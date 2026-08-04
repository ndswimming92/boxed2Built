import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, Job, JobStatus } from '../../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, AlertCircle, CheckCircle, Briefcase, DollarSign, Clock, TrendingUp, Search, Filter, Download, Upload, Copy, CheckCircle2, FileText, Link as LinkIcon, XCircle, Ban, Info, Gift, Building2, MapPin, Calendar, ChevronDown, Phone, Mail } from 'lucide-react';
import {
  calculateNetProfit,
  calculateHourlyRate,
  formatCurrency,
  formatDate,
  formatHours,
} from '../../utils/jobCalculations';
import JobFormModal from '../../components/admin/JobFormModal';
import ImportJobsModal from '../../components/admin/ImportJobsModal';
import JobCompletionWizard from '../../components/admin/JobCompletionWizard';
import InvoiceFormModal from '../../components/admin/InvoiceFormModal';
import AttachInvoiceModal from '../../components/admin/AttachInvoiceModal';
import JobInvoicesList from '../../components/admin/JobInvoicesList';
import JobContractorsList from '../../components/admin/JobContractorsList';
import MarkJobLostModal from '../../components/admin/MarkJobLostModal';
import CancelJobModal from '../../components/admin/CancelJobModal';
import { exportJobsToCSV, downloadCSV, generateExportFilename } from '../../services/jobExportService';
import { attachInvoiceToJob } from '../../services/invoiceService';
import { jobStatusService } from '../../services/jobStatusService';
import { getJobContractorTotals } from '../../services/contractorService';
import { usePrivacyMode } from '../../contexts/PrivacyModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../services/auditLogService';

interface JobStats {
  totalJobs: number;
  totalRevenue: number;
  totalProfit: number;
  avgHourlyRate: number;
}

interface JobsPageLocationState {
  createJobFromInvoice?: {
    invoiceId: string;
    sourceInvoiceNumber?: string;
    initialData?: Partial<Job>;
  };
}

export default function JobsPage() {
  const { maskFinancialValue } = usePrivacyMode();
  const { currentOrganization } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as JobsPageLocationState | null;
  const createJobFromInvoice = locationState?.createJobFromInvoice;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<JobStats>({ totalJobs: 0, totalRevenue: 0, totalProfit: 0, avgHourlyRate: 0 });
  const [contractorTotals, setContractorTotals] = useState<Record<string, number>>({});
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copyingJob, setCopyingJob] = useState<Partial<Job> | null>(null);
  const [completingJob, setCompletingJob] = useState<Job | null>(null);
  const [creatingInvoiceForJob, setCreatingInvoiceForJob] = useState<Job | null>(null);
  const [attachingInvoiceToJob, setAttachingInvoiceToJob] = useState<Job | null>(null);
  const [markingJobLost, setMarkingJobLost] = useState<Job | null>(null);
  const [cancellingJob, setCancellingJob] = useState<Job | null>(null);
  const [showInactiveJobs, setShowInactiveJobs] = useState(false);
  const [showMissingHoursOnly, setShowMissingHoursOnly] = useState(false);
  const [invoiceToConvert, setInvoiceToConvert] = useState<JobsPageLocationState['createJobFromInvoice'] | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [jobs, searchTerm, statusFilter, locationFilter, showInactiveJobs, showMissingHoursOnly]);

  useEffect(() => {
    if (!createJobFromInvoice) {
      return;
    }

    setInvoiceToConvert(createJobFromInvoice);
    setEditingJob(null);
    setCopyingJob(createJobFromInvoice.initialData || null);
    setShowModal(true);

    navigate(location.pathname, { replace: true, state: null });
  }, [createJobFromInvoice, navigate, location.pathname]);

  const fetchData = async () => {
    try {
      const { data: bizData } = await supabase
        .from('business_info')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (bizData) {
        setBusinessId(bizData.id);
        setBusinessInfo({
          name: bizData.name || 'Boxed2Built',
          address: bizData.street_address || '',
          phone: bizData.phone || '',
          email: bizData.email || '',
          website: 'www.boxed2built.com',
        });
        const { data } = await supabase
          .from('jobs')
          .select('*')
          .eq('business_id', bizData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (data) {
          setJobs(data);
          const totals = await getJobContractorTotals(bizData.id);
          setContractorTotals(totals);
          calculateStats(data, totals);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (jobsList: Job[], totals: Record<string, number> = {}) => {
    const completedJobs = jobsList.filter(job => job.date_completed);
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.final_price || 0), 0);
    const totalProfit = completedJobs.reduce((sum, job) => sum + calculateNetProfit(job.final_price, job.materials_cost, totals[job.id] || 0), 0);
    const totalHours = completedJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
    const avgHourlyRate = totalHours > 0 ? totalProfit / totalHours : 0;

    setStats({
      totalJobs: jobsList.length,
      totalRevenue,
      totalProfit,
      avgHourlyRate,
    });
  };

  const isCompletedMissingHoursWorked = (job: Job) => {
    const isCompleted = job.job_status === 'completed' || Boolean(job.date_completed);
    return isCompleted && (job.hours_worked === null || job.hours_worked === undefined || job.hours_worked <= 0);
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    if (!showInactiveJobs) {
      filtered = filtered.filter(job =>
        job.job_status !== 'lost' && job.job_status !== 'cancelled'
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.client_name?.toLowerCase().includes(term) ||
        job.client_phone?.toLowerCase().includes(term) ||
        job.client_email?.toLowerCase().includes(term) ||
        job.job_type?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(job => job.job_status === statusFilter.toLowerCase());
    }

    if (locationFilter !== 'All') {
      filtered = filtered.filter(job => job.location_city === locationFilter);
    }

    if (showMissingHoursOnly) {
      filtered = filtered.filter((job) => isCompletedMissingHoursWorked(job));
    }

    setFilteredJobs(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job? This action cannot be undone.')) return;

    const jobToDelete = jobs.find(j => j.id === id);

    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      await logAction({
        actionType: 'DELETE',
        tableName: 'jobs',
        recordId: id,
        recordIdentifier: jobToDelete ? `${jobToDelete.client_name} - ${jobToDelete.job_type}` : id,
      });
      setMessage({ type: 'success', text: 'Job deleted successfully!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      await logAction({
        actionType: 'DELETE',
        tableName: 'jobs',
        recordId: id,
        recordIdentifier: jobToDelete ? `${jobToDelete.client_name} - ${jobToDelete.job_type}` : id,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      setMessage({ type: 'error', text: 'Failed to delete job' });
    }
  };

  const handleExportJobs = () => {
    const csv = exportJobsToCSV(jobs);
    const filename = generateExportFilename();
    downloadCSV(csv, filename);
    logAction({ actionType: 'EXPORT', tableName: 'jobs', recordIdentifier: `${jobs.length} jobs` });
    setMessage({ type: 'success', text: `Exported ${jobs.length} jobs successfully!` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportSuccess = (count: number) => {
    fetchData();
    logAction({ actionType: 'IMPORT', tableName: 'jobs', recordIdentifier: `${count} jobs` });
    setMessage({ type: 'success', text: `Successfully imported ${count} jobs!` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCopyJob = (job: Job) => {
    const jobCopy: Partial<Job> = {
      client_name: job.client_name,
      client_phone: job.client_phone,
      client_email: job.client_email,
      job_type: job.job_type,
      job_description: job.job_description,
      location_city: job.location_city,
      quoted_price: job.quoted_price,
      materials_cost: job.materials_cost,
      payment_method: job.payment_method,
      repeat_client: true,
      referral_source: job.referral_source,
      date_quoted: null,
      date_scheduled: null,
      date_completed: null,
      hours_worked: null,
      final_price: null,
      payment_date: null,
      reviews_received: false,
      google_review_link_sent: false,
      notes: job.notes ? `Copied from previous job\n\n${job.notes}` : 'Copied from previous job',
    };

    setCopyingJob(jobCopy);
    setEditingJob(null);
    setShowModal(true);
  };

  const uniqueLocations = Array.from(new Set(jobs.map(job => job.location_city).filter(Boolean))) as string[];
  const missingCompletedHoursCount = jobs.filter((job) => isCompletedMissingHoursWorked(job)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Jobs</h1>
          <p className="text-sm sm:text-base text-slate-600">Track and manage all your completed jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExportJobs}
            className="px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-sm"
            title="Export jobs to CSV"
          >
            <Upload className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-sm"
            title="Import jobs from CSV"
          >
            <Download className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => {
              setInvoiceToConvert(null);
              setEditingJob(null);
              setCopyingJob(null);
              setShowModal(true);
            }}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {missingCompletedHoursCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-amber-700" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Data quality warning:</span> {missingCompletedHoursCount} completed job{missingCompletedHoursCount === 1 ? '' : 's'} are missing hours worked. Backfill these to keep all-time hourly metrics accurate.
              </p>
            </div>
            <button
              onClick={() => setShowMissingHoursOnly((prev) => !prev)}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showMissingHoursOnly ? 'border-amber-700 bg-amber-700 text-white hover:bg-amber-800' : 'border-amber-400 bg-white text-amber-800 hover:bg-amber-100'}`}
            >
              {showMissingHoursOnly ? 'Show All Jobs' : 'Show Missing Hours Only'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Total Jobs</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalJobs}</p>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Revenue</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{maskFinancialValue(formatCurrency(stats.totalRevenue))}</p>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-violet-100 rounded-lg">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Profit</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{maskFinancialValue(formatCurrency(stats.totalProfit))}</p>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Avg Rate</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{maskFinancialValue(formatCurrency(stats.avgHourlyRate))}/hr</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input name="searchTerm"
              type="text"
              placeholder="Search by client name, phone, email, or job type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center gap-2 ${showFilters ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select name="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'All')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Quoted">Quoted</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  {showInactiveJobs && (
                    <>
                      <option value="Lost">Lost</option>
                      <option value="Cancelled">Cancelled</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                <select name="locationFilter"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Locations</option>
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showInactiveJobs"
                checked={showInactiveJobs}
                onChange={(e) => setShowInactiveJobs(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="showInactiveJobs" className="ml-2 text-sm text-slate-700">
                Show lost and cancelled jobs
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showMissingHoursOnly"
                checked={showMissingHoursOnly}
                onChange={(e) => setShowMissingHoursOnly(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="showMissingHoursOnly" className="ml-2 text-sm text-slate-700">
                Show completed jobs missing hours worked
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">
              {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
            </p>
            {jobs.length === 0 && (
              <button
                onClick={() => {
                  setInvoiceToConvert(null);
                  setEditingJob(null);
                  setCopyingJob(null);
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                Add Your First Job
              </button>
            )}
          </div>
        ) : (
          filteredJobs.map((job) => {
            const contractorCost = contractorTotals[job.id] || 0;
            const netProfit = calculateNetProfit(job.final_price, job.materials_cost, contractorCost);
            const hourlyRate = calculateHourlyRate(job.final_price, job.materials_cost, job.hours_worked, contractorCost);
            const statusLabel = jobStatusService.getStatusLabel(job.job_status);
            const statusColor = jobStatusService.getStatusColor(job.job_status);
            const isInactive = job.job_status === 'lost' || job.job_status === 'cancelled';
            const missingHours = isCompletedMissingHoursWorked(job);
            const isExpanded = expandedJobIds.has(job.id);

            return (
              <div key={job.id} className={`bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow overflow-hidden ${isInactive ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  onClick={() => toggleJobExpanded(job.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className={`text-xl font-semibold ${isInactive ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {job.client_name}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {job.job_status === 'lost' && job.lost_reason_category && (
                        <span className="px-3 py-1 text-xs rounded-full border bg-gray-100 text-gray-700 border-gray-200 flex items-center gap-1" title={job.lost_reason_notes || job.lost_reason_category}>
                          <Info className="w-3 h-3" />
                          {job.lost_reason_category}
                        </span>
                      )}
                      {job.is_free && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-cyan-100 text-cyan-800 border-cyan-200 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          Free
                        </span>
                      )}
                      {job.client_type === 'business' && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-sky-100 text-sky-800 border-sky-200 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Business
                        </span>
                      )}
                      {job.repeat_client && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-indigo-100 text-indigo-800 border-indigo-200">
                          Repeat Client
                        </span>
                      )}
                      {job.has_signature && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Signed Off
                        </span>
                      )}
                      {missingHours && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full border bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Missing Hours
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                      {job.client_phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {job.client_phone}
                        </span>
                      )}
                      {job.client_email && (
                        <span className="flex items-center gap-1.5 min-w-0 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{job.client_email}</span>
                        </span>
                      )}
                      {job.job_type && (
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {job.job_type}
                        </span>
                      )}
                      {job.location_city && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {job.location_city}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 mt-1.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-1 border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-end gap-2 mb-4 pt-4">
                      {!isInactive && (
                        <>
                          {(job.date_scheduled || job.date_completed) && !job.has_signature && (
                            <button
                              onClick={() => setCompletingJob(job)}
                              className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
                              title="Complete job with customer signature"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Complete Job
                            </button>
                          )}
                          {(job.job_status === 'quoted' || job.job_status === 'scheduled') && (
                            <button
                              onClick={() => setMarkingJobLost(job)}
                              className="px-3 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-medium hover:bg-amber-200 transition-colors flex items-center gap-2 text-sm"
                              title="Mark job as lost"
                            >
                              <XCircle className="w-4 h-4" />
                              Mark Lost
                            </button>
                          )}
                          {(job.job_status === 'accepted' || job.job_status === 'scheduled' || job.job_status === 'in_progress') && (
                            <button
                              onClick={() => setCancellingJob(job)}
                              className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center gap-2 text-sm"
                              title="Cancel job"
                            >
                              <Ban className="w-4 h-4" />
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setCreatingInvoiceForJob(job)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Create invoice from job"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setAttachingInvoiceToJob(job)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Attach existing invoice"
                          >
                            <LinkIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleCopyJob(job)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Copy job"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => { setEditingJob(job); setCopyingJob(null); setShowModal(true); }}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit job"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete job"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3" />
                          Job Type
                        </p>
                        <p className="text-sm font-semibold text-slate-900 truncate" title={job.job_type || 'N/A'}>{job.job_type || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          Location
                        </p>
                        <p className="text-sm font-semibold text-slate-900 truncate" title={job.location_city || 'N/A'}>{job.location_city || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Completed
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{formatDate(job.date_completed)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Hours Worked
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{formatHours(job.hours_worked)}</p>
                      </div>
                    </div>

                    {missingHours && (
                      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        This completed job is missing hours worked. Please edit and backfill to keep profitability metrics reliable.
                      </div>
                    )}

                    {job.is_free ? (
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-3 rounded-lg bg-cyan-50 border border-cyan-100 px-4 py-3 w-full">
                          <Gift className="w-5 h-5 text-cyan-600 shrink-0" />
                          <p className="text-sm font-semibold text-cyan-800">Free Job — no financial tracking</p>
                          {job.hours_worked && job.hours_worked > 0 && (
                            <span className="ml-auto text-sm font-medium text-cyan-700">{formatHours(job.hours_worked)} hrs worked</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-slate-200">
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Final Price</p>
                          <p className="text-lg font-bold text-slate-900">{maskFinancialValue(formatCurrency(job.final_price))}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Materials Cost</p>
                          <p className="text-lg font-bold text-slate-900">{maskFinancialValue(formatCurrency(job.materials_cost))}</p>
                        </div>
                        {contractorCost > 0 && (
                          <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400 mb-1">Contractor Pay</p>
                            <p className="text-lg font-bold text-rose-600">{maskFinancialValue(formatCurrency(contractorCost))}</p>
                          </div>
                        )}
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500 mb-1">Net Profit</p>
                          <p className="text-lg font-bold text-emerald-600">{maskFinancialValue(formatCurrency(netProfit))}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500 mb-1">Hourly Rate</p>
                          <p className="text-lg font-bold text-emerald-600">{maskFinancialValue(formatCurrency(hourlyRate))}/hr</p>
                        </div>
                      </div>
                    )}

                    {job.job_description && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Description</p>
                        <p className="text-sm text-slate-700 leading-relaxed rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">{job.job_description}</p>
                      </div>
                    )}

                    {businessInfo && (
                      <JobInvoicesList
                        jobId={job.id}
                        businessInfo={businessInfo}
                        onInvoiceDetached={fetchData}
                      />
                    )}

                    {businessId && (
                      <JobContractorsList
                        jobId={job.id}
                        businessId={businessId}
                        organizationId={currentOrganization?.id ?? null}
                        jobRevenue={job.final_price}
                        onChange={fetchData}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showModal && businessId && (
        <JobFormModal
          job={editingJob}
          businessId={businessId}
          initialData={copyingJob || undefined}
          title={invoiceToConvert?.invoiceId ? 'Create Job From Invoice' : undefined}
          onClose={() => {
            setShowModal(false);
            setEditingJob(null);
            setCopyingJob(null);
            setInvoiceToConvert(null);
          }}
          onSave={async (savedJob) => {
            if (invoiceToConvert?.invoiceId && savedJob?.id) {
              try {
                await attachInvoiceToJob(invoiceToConvert.invoiceId, savedJob.id);
              } catch (error) {
                console.error('Error linking invoice to newly created job:', error);
                setMessage({ type: 'error', text: 'Job created, but failed to link the invoice.' });
                setTimeout(() => setMessage(null), 4000);
                fetchData();
                return;
              }
            }

            if (savedJob) {
              await logAction({
                actionType: editingJob ? 'UPDATE' : 'CREATE',
                tableName: 'jobs',
                recordId: savedJob.id,
                recordIdentifier: `${savedJob.client_name} - ${savedJob.job_type}`,
              });
            }

            fetchData();
            const messageText = editingJob
              ? 'Job updated successfully!'
              : invoiceToConvert?.invoiceId
                ? `Job created from invoice ${invoiceToConvert.sourceInvoiceNumber || ''}`.trim()
                : copyingJob
                  ? 'Job copied and saved successfully!'
                  : 'Job added successfully!';
            setMessage({ type: 'success', text: messageText });
            setInvoiceToConvert(null);
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {showImportModal && businessId && (
        <ImportJobsModal
          businessId={businessId}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {completingJob && (
        <JobCompletionWizard
          job={completingJob}
          onClose={() => setCompletingJob(null)}
          onSuccess={() => {
            setCompletingJob(null);
            fetchData();
            setMessage({ type: 'success', text: 'Job completed successfully!' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {creatingInvoiceForJob && businessId && (
        <InvoiceFormModal
          businessId={businessId}
          jobId={creatingInvoiceForJob.id}
          initialData={{
            client_name: creatingInvoiceForJob.client_name,
            client_email: creatingInvoiceForJob.client_email || undefined,
            client_phone: creatingInvoiceForJob.client_phone || undefined,
          }}
          onClose={() => setCreatingInvoiceForJob(null)}
          onSaved={() => {
            setCreatingInvoiceForJob(null);
            fetchData();
            setMessage({ type: 'success', text: 'Invoice created successfully!' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {attachingInvoiceToJob && businessId && (
        <AttachInvoiceModal
          job={attachingInvoiceToJob}
          businessId={businessId}
          onClose={() => setAttachingInvoiceToJob(null)}
          onAttached={() => {
            setAttachingInvoiceToJob(null);
            fetchData();
            setMessage({ type: 'success', text: 'Invoice attached successfully!' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {markingJobLost && (
        <MarkJobLostModal
          job={markingJobLost}
          isOpen={true}
          onClose={() => setMarkingJobLost(null)}
          onSuccess={() => {
            setMarkingJobLost(null);
            fetchData();
            setMessage({ type: 'success', text: 'Job marked as lost successfully!' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {cancellingJob && (
        <CancelJobModal
          job={cancellingJob}
          isOpen={true}
          onClose={() => setCancellingJob(null)}
          onSuccess={() => {
            setCancellingJob(null);
            fetchData();
            setMessage({ type: 'success', text: 'Job cancelled successfully!' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
