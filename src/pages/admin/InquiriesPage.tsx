import { useEffect, useState } from 'react';
import { supabase, FormInquiry, Job } from '../../lib/supabase';
import { Inbox, Search, Filter, Archive, CheckCircle, AlertCircle, Mail, MessageSquare, ExternalLink, Trash2, RefreshCw, FlaskConical, Image, Building2, Clock } from 'lucide-react';
import { markAsViewed, archiveInquiry, deleteInquiry, getInquiryStats, convertToJob as convertInquiryToJob, markAsConverted } from '../../services/inquiryService';
import { useRealtimeInquiries } from '../../hooks/useRealtimeInquiries';
import InquiryDetailModal from '../../components/admin/InquiryDetailModal';
import JobFormModal from '../../components/admin/JobFormModal';
import { logAction } from '../../services/auditLogService';

interface InquiryStats {
  total: number;
  pending: number;
  converted: number;
  archived: number;
  conversionRate: number;
}

export default function InquiriesPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'pending' | 'converted_to_job' | 'archived'>('active');
  const [furnitureTypeFilter, setFurnitureTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<InquiryStats>({ total: 0, pending: 0, converted: 0, archived: 0, conversionRate: 0 });
  const [filteredInquiries, setFilteredInquiries] = useState<FormInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<FormInquiry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobFormData, setJobFormData] = useState<Partial<Job> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showTestData, setShowTestData] = useState(false);

  const { inquiries, refresh } = useRealtimeInquiries({ businessId, includeTestData: showTestData });

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchStats();
    }
  }, [businessId, inquiries, showTestData]);

  useEffect(() => {
    applyFilters();
  }, [inquiries, searchTerm, statusFilter, furnitureTypeFilter, sourceFilter]);

  const fetchBusinessId = async () => {
    try {
      const { data } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setBusinessId(data.id);
      }
    } catch (error) {
      console.error('Error fetching business ID:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!businessId) return;
    try {
      const data = await getInquiryStats(businessId, showTestData);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const previousCount = inquiries.length;

    try {
      const refreshedInquiries = await refresh();
      await fetchStats();
      setLastUpdated(new Date());

      const refreshedCount = refreshedInquiries.length;
      const newSubmissions = refreshedCount - previousCount;

      if (newSubmissions > 0) {
        setMessage({
          type: 'success',
          text: `Found ${newSubmissions} new submission${newSubmissions !== 1 ? 's' : ''}!`
        });
      } else {
        setMessage({
          type: 'success',
          text: 'All caught up! No new submissions.'
        });
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error refreshing inquiries:', error);
      setMessage({ type: 'error', text: 'Failed to refresh inquiries' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastUpdated = () => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
  };

  const applyFilters = () => {
    let filtered = [...inquiries];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inquiry) =>
          inquiry.client_name?.toLowerCase().includes(term) ||
          inquiry.client_email?.toLowerCase().includes(term) ||
          inquiry.client_phone?.toLowerCase().includes(term) ||
          inquiry.furniture_type?.toLowerCase().includes(term) ||
          inquiry.confirmation_code?.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'active') {
      // Default view: hide inquiries that are done (converted) or dismissed (archived)
      filtered = filtered.filter((inquiry) => inquiry.status === 'pending');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.status === statusFilter);
    }

    if (furnitureTypeFilter !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.furniture_type === furnitureTypeFilter);
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.source === sourceFilter);
    }

    setFilteredInquiries(filtered);
  };

  const handleViewInquiry = async (inquiry: FormInquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetailModal(true);

    if (!inquiry.viewed) {
      try {
        await markAsViewed(inquiry.id);
        await refresh();
      } catch (error) {
        console.error('Error marking as viewed:', error);
      }
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this inquiry? You can still view it later by filtering for archived inquiries.')) return;

    const inquiry = filteredInquiries.find(i => i.id === id);
    try {
      await archiveInquiry(id);
      await logAction({
        actionType: 'ARCHIVE',
        tableName: 'form_inquiries',
        recordId: id,
        recordIdentifier: inquiry?.client_name,
      });
      setMessage({ type: 'success', text: 'Inquiry archived successfully!' });
      await refresh();
      await fetchStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error archiving inquiry:', error);
      setMessage({ type: 'error', text: 'Failed to archive inquiry' });
    }
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!confirm(`Delete inquiry from ${clientName}? This action cannot be undone and will remove this inquiry from all metrics.`)) return;

    try {
      await deleteInquiry(id);
      await logAction({
        actionType: 'DELETE',
        tableName: 'form_inquiries',
        recordId: id,
        recordIdentifier: clientName,
      });
      setMessage({ type: 'success', text: 'Inquiry deleted successfully!' });
      await refresh();
      await fetchStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      setMessage({ type: 'error', text: 'Failed to delete inquiry' });
    }
  };

  const handleConvertToJob = (inquiry: FormInquiry) => {
    const initialData: Partial<Job> = {
      client_id: inquiry.client_id,
      client_name: inquiry.client_name,
      client_email: inquiry.client_email,
      client_phone: inquiry.client_phone,
      job_type: inquiry.furniture_type,
      job_description: inquiry.notes || `${inquiry.furniture_type} assembly - ${inquiry.pieces} ${inquiry.pieces === 1 ? 'piece' : 'pieces'}`,
      location_city: inquiry.user_city,
      date_quoted: new Date().toISOString().split('T')[0],
      quoted_price: inquiry.estimated_price ? parseFloat(inquiry.estimated_price.replace(/[^0-9.]/g, '')) : undefined,
      referral_source: inquiry.source || 'contact_form',
      notes: inquiry.notes || undefined,
      client_type: inquiry.client_type || 'residential',
    };

    setJobFormData(initialData);
    setSelectedInquiry(inquiry);
    setShowDetailModal(false);
    setShowJobModal(true);
  };

  const handleJobSaved = async (savedJob?: Job) => {
    if (!selectedInquiry) return;

    try {
      if (savedJob?.id) {
        await convertInquiryToJob(selectedInquiry.id, savedJob.id);
        await logAction({
          actionType: 'UPDATE',
          tableName: 'form_inquiries',
          recordId: selectedInquiry.id,
          recordIdentifier: selectedInquiry.client_name,
          metadata: { converted_to_job_id: savedJob.id },
        });
      }

      setMessage({ type: 'success', text: 'Inquiry converted to job successfully!' });
      await refresh();
      await fetchStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error converting inquiry:', error);
      setMessage({ type: 'error', text: 'Job created but failed to update inquiry status' });
    }
  };

  const handleMarkConverted = async (inquiry: FormInquiry) => {
    if (!confirm(`Mark ${inquiry.client_name}'s inquiry as converted? Use this when a job already exists for it. It will count toward your conversion rate.`)) return;

    try {
      await markAsConverted(inquiry.id);
      await logAction({
        actionType: 'UPDATE',
        tableName: 'form_inquiries',
        recordId: inquiry.id,
        recordIdentifier: inquiry.client_name,
        metadata: { status: 'converted_to_job', manual: true },
      });
      setMessage({ type: 'success', text: 'Inquiry marked as converted!' });
      setShowDetailModal(false);
      setSelectedInquiry(null);
      await refresh();
      await fetchStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error marking inquiry as converted:', error);
      setMessage({ type: 'error', text: 'Failed to mark inquiry as converted' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'converted_to_job':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'converted_to_job':
        return 'Converted';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      if (hours < 1) {
        const minutes = Math.floor(diffInMs / (1000 * 60));
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const uniqueFurnitureTypes = Array.from(new Set(inquiries.map((i) => i.furniture_type).filter(Boolean)));
  const uniqueSources = Array.from(new Set(inquiries.map((i) => i.source).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Form Inquiries</h1>
            <p className="text-sm sm:text-base text-slate-600">Manage customer inquiries from your website contact form</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowTestData(!showTestData)}
              className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 border text-sm ${
                showTestData
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={showTestData ? 'Hide test submissions' : 'Show test submissions'}
            >
              <FlaskConical className="w-4 h-4" />
              <span>{showTestData ? 'Hide Tests' : 'Show Tests'}</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`relative px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 text-sm ${
                isRefreshing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'
              }`}
              title="Check for new form submissions"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Check for New</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Last updated: {formatLastUpdated()}</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Auto-refresh active
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Total</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('active');
            setShowFilters(true);
          }}
          className={`text-left bg-white rounded-xl p-4 sm:p-6 border transition-all hover:shadow-md hover:-translate-y-0.5 ${
            statusFilter === 'active' ? 'border-yellow-400 ring-1 ring-yellow-300' : 'border-slate-200'
          }`}
          title="Show pending inquiries"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Pending</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.pending}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('converted_to_job');
            setShowFilters(true);
          }}
          className={`text-left bg-white rounded-xl p-4 sm:p-6 border transition-all hover:shadow-md hover:-translate-y-0.5 ${
            statusFilter === 'converted_to_job' ? 'border-green-400 ring-1 ring-green-300' : 'border-slate-200'
          }`}
          title="Show inquiries converted to jobs"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Converted</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.converted}</p>
        </button>

        <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-teal-100 rounded-lg">
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Conv. Rate</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.conversionRate}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input name="searchTerm"
              type="text"
              placeholder="Search by name, email, phone, furniture type, or confirmation code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center gap-2 ${
              showFilters ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select name="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">Active (Pending)</option>
                <option value="all">All Statuses</option>
                <option value="converted_to_job">Converted</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Furniture Type</label>
              <select name="furnitureTypeFilter"
                value={furnitureTypeFilter}
                onChange={(e) => setFurnitureTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Types</option>
                {uniqueFurnitureTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Source</label>
              <select name="sourceFilter"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Sources</option>
                {uniqueSources.map((source) => (
                  <option key={source} value={source}>
                    {source === 'footer_quick_contact' ? 'Footer Quick Contact' : source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {filteredInquiries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-2 text-lg font-medium">
              {inquiries.length === 0 ? 'No inquiries yet' : 'No inquiries match your filters'}
            </p>
            {inquiries.length === 0 ? (
              <div className="text-sm text-slate-500 space-y-2">
                <p>Inquiries from your contact form will appear here automatically</p>
                <p className="flex items-center justify-center gap-2 mt-4">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Real-time updates enabled</span>
                </p>
                <p className="mt-2">Or click the "Check for New" button to manually refresh</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Try adjusting your filters to see more results</p>
            )}
          </div>
        ) : (
          filteredInquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className={`group relative rounded-2xl border p-6 cursor-pointer transition-all duration-200 overflow-hidden ${
                !inquiry.viewed
                  ? 'border-blue-300 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-sm hover:shadow-lg hover:-translate-y-0.5'
                  : 'border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
              }`}
              onClick={() => handleViewInquiry(inquiry)}
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 ${
                  inquiry.status === 'converted_to_job'
                    ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-400'
                    : inquiry.status === 'archived'
                      ? 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300'
                      : 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300'
                }`}
              />
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {!inquiry.viewed && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">NEW</span>
                    )}
                    {inquiry.is_test && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" />
                        TEST
                      </span>
                    )}
                    <h3 className="break-words text-xl font-semibold text-slate-900">{inquiry.client_name}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(inquiry.status)}`}>
                      {getStatusLabel(inquiry.status)}
                    </span>
                    {inquiry.client_type === 'business' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Business
                      </span>
                    )}
                    {inquiry.source === 'footer_quick_contact' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white border border-blue-300 shadow-sm">
                        Quick Contact
                      </span>
                    )}
                    {(inquiry.furniture_photo_url || inquiry.furniture_image_path) && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1" title="Customer provided a photo or product link">
                        <Image className="w-3 h-3" />
                        Photo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5 break-all bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1">
                      <Mail className="w-4 h-4 text-slate-500" />
                      {inquiry.client_email}
                    </span>
                    {inquiry.client_phone && (
                      <span className="flex items-center gap-1.5 break-all bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1">
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        {inquiry.client_phone}
                      </span>
                    )}
                    <span className="text-slate-500 bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1">
                      {formatDate(inquiry.submission_date)}
                    </span>
                    {inquiry.confirmation_code && (
                      <span className="px-2.5 py-1 text-xs font-mono bg-white/90 text-slate-700 rounded-lg border border-slate-200 shadow-sm">
                        {inquiry.confirmation_code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  {inquiry.status !== 'archived' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(inquiry.id);
                      }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Archive"
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(inquiry.id, inquiry.client_name);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/80 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Furniture Type</p>
                  <p className="text-sm font-semibold text-slate-900">{inquiry.furniture_type}</p>
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Pieces</p>
                  <p className="text-sm font-semibold text-slate-900">{inquiry.pieces}</p>
                </div>
                {inquiry.estimated_price && (
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-wide">Est. Price</p>
                    <p className="text-sm font-bold text-emerald-700">{inquiry.estimated_price}</p>
                  </div>
                )}
                {inquiry.estimated_time && (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Est. Time</p>
                    <p className="text-sm font-bold text-blue-900">{inquiry.estimated_time}</p>
                  </div>
                )}
              </div>

              {/* Response Time Indicator */}
              <div className="mt-3">
                {inquiry.first_responded_at ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${
                    (() => {
                      const seconds = (new Date(inquiry.first_responded_at).getTime() - new Date(inquiry.submission_date).getTime()) / 1000;
                      const hours = seconds / 3600;
                      if (hours < 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      if (hours < 4) return 'bg-amber-50 text-amber-700 border-amber-200';
                      return 'bg-red-50 text-red-700 border-red-200';
                    })()
                  }`}>
                    <CheckCircle className="w-3 h-3" />
                    Responded in {(() => {
                      const seconds = (new Date(inquiry.first_responded_at).getTime() - new Date(inquiry.submission_date).getTime()) / 1000;
                      const minutes = Math.floor(seconds / 60);
                      const hours = Math.floor(minutes / 60);
                      const days = Math.floor(hours / 24);
                      if (days > 0) return `${days}d ${hours % 24}h`;
                      if (hours > 0) return `${hours}h ${minutes % 60}m`;
                      if (minutes > 0) return `${minutes}m`;
                      return 'under 1m';
                    })()}
                  </span>
                ) : inquiry.status === 'pending' ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${
                    (() => {
                      const seconds = (Date.now() - new Date(inquiry.submission_date).getTime()) / 1000;
                      const hours = seconds / 3600;
                      if (hours < 1) return 'bg-amber-50 text-amber-700 border-amber-200';
                      if (hours < 4) return 'bg-orange-50 text-orange-700 border-orange-200';
                      return 'bg-red-50 text-red-700 border-red-200';
                    })()
                  }`}>
                    <Clock className="w-3 h-3" />
                    {(() => {
                      const seconds = (Date.now() - new Date(inquiry.submission_date).getTime()) / 1000;
                      const minutes = Math.floor(seconds / 60);
                      const hours = Math.floor(minutes / 60);
                      const days = Math.floor(hours / 24);
                      if (days > 0) return `${days}d ${hours % 24}h waiting`;
                      if (hours > 0) return `${hours}h ${minutes % 60}m waiting`;
                      if (minutes > 0) return `${minutes}m waiting`;
                      return 'Just submitted';
                    })()}
                  </span>
                ) : null}
              </div>

              {inquiry.notes && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Notes</p>
                  <p className="text-sm text-slate-700 line-clamp-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                    {inquiry.notes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showDetailModal && selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInquiry(null);
          }}
          onArchive={async () => {
            await refresh();
            await fetchStats();
          }}
          onDelete={async () => {
            await refresh();
            await fetchStats();
          }}
          onConvertToJob={handleConvertToJob}
          onMarkConverted={handleMarkConverted}
          onRefresh={refresh}
        />
      )}

      {showJobModal && jobFormData && businessId && (
        <JobFormModal
          job={null}
          businessId={businessId}
          initialData={jobFormData}
          onClose={() => {
            setShowJobModal(false);
            setJobFormData(null);
          }}
          onSave={handleJobSaved}
        />
      )}
    </div>
  );
}
