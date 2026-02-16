import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, Job, JobStatus } from '../../lib/supabase';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, Briefcase, DollarSign, Clock, TrendingUp, Search, Filter, Download, Upload, Copy, CheckCircle2, Star, FileText, Link as LinkIcon, Navigation, XCircle, Ban, Info } from 'lucide-react';
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
import MileageTrackerButton from '../../components/admin/MileageTrackerButton';
import MileageRecordsList from '../../components/admin/MileageRecordsList';
import MarkJobLostModal from '../../components/admin/MarkJobLostModal';
import CancelJobModal from '../../components/admin/CancelJobModal';
import { exportJobsToCSV, downloadCSV, generateExportFilename } from '../../services/jobExportService';
import { attachInvoiceToJob } from '../../services/invoiceService';
import { jobStatusService } from '../../services/jobStatusService';

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
  const [invoiceToConvert, setInvoiceToConvert] = useState<JobsPageLocationState['createJobFromInvoice'] | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [jobs, searchTerm, statusFilter, locationFilter, showInactiveJobs]);

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
          calculateStats(data);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (jobsList: Job[]) => {
    const completedJobs = jobsList.filter(job => job.date_completed);
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.final_price || 0), 0);
    const totalProfit = completedJobs.reduce((sum, job) => sum + calculateNetProfit(job.final_price, job.materials_cost), 0);
    const totalHours = completedJobs.reduce((sum, job) => sum + (job.hours_worked || 0), 0);
    const avgHourlyRate = totalHours > 0 ? totalProfit / totalHours : 0;

    setStats({
      totalJobs: jobsList.length,
      totalRevenue,
      totalProfit,
      avgHourlyRate,
    });
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

    setFilteredJobs(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job? This action cannot be undone.')) return;

    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Job deleted successfully!' });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setMessage({ type: 'error', text: 'Failed to delete job' });
    }
  };

  const handleExportJobs = () => {
    const csv = exportJobsToCSV(jobs);
    const filename = generateExportFilename();
    downloadCSV(csv, filename);
    setMessage({ type: 'success', text: `Exported ${jobs.length} jobs successfully!` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportSuccess = (count: number) => {
    fetchData();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Jobs</h1>
          <p className="text-slate-600">Track and manage all your completed jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJobs}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            title="Export jobs to CSV"
          >
            <Upload className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            title="Import jobs from CSV"
          >
            <Download className="w-5 h-5" />
            Import
          </button>
          <button
            onClick={() => {
              setInvoiceToConvert(null);
              setEditingJob(null);
              setCopyingJob(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Total Jobs</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalJobs}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Total Profit</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalProfit)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Avg Hourly Rate</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.avgHourlyRate)}/hr</p>
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
            const netProfit = calculateNetProfit(job.final_price, job.materials_cost);
            const hourlyRate = calculateHourlyRate(job.final_price, job.materials_cost, job.hours_worked);
            const statusLabel = jobStatusService.getStatusLabel(job.job_status);
            const statusColor = jobStatusService.getStatusColor(job.job_status);
            const isInactive = job.job_status === 'lost' || job.job_status === 'cancelled';

            return (
              <div key={job.id} className={`bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow ${isInactive ? 'opacity-60' : ''}`}>
                <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
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
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      {job.client_phone && <span>{job.client_phone}</span>}
                      {job.client_email && <span>{job.client_email}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Job Type</p>
                    <p className="text-sm font-medium text-slate-900">{job.job_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">{job.location_city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Completed</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(job.date_completed)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Hours Worked</p>
                    <p className="text-sm font-medium text-slate-900">{formatHours(job.hours_worked)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Final Price</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(job.final_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Materials Cost</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(job.materials_cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Net Profit</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(netProfit)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Hourly Rate</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(hourlyRate)}/hr</p>
                  </div>
                  {(job.total_mileage ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        Mileage Deduction
                      </p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(job.mileage_deduction)}</p>
                      <p className="text-xs text-slate-500">{job.total_mileage?.toFixed(1)} mi</p>
                    </div>
                  )}
                </div>

                {job.job_description && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                    <p className="text-sm text-slate-700">{job.job_description}</p>
                  </div>
                )}

                {businessInfo && (
                  <JobInvoicesList
                    jobId={job.id}
                    businessInfo={businessInfo}
                    onInvoiceDetached={fetchData}
                  />
                )}

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                      {businessId && (
                        <MileageTrackerButton
                          job={job}
                          businessId={businessId}
                          onTrackingComplete={fetchData}
                        />
                      )}
                    </div>
                    <div className="lg:col-span-2">
                      {businessId && (
                        <MileageRecordsList
                          jobId={job.id}
                          businessId={businessId}
                          onUpdate={fetchData}
                        />
                      )}
                    </div>
                  </div>
                </div>
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
