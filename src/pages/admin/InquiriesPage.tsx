import React, { useEffect, useState } from 'react';
import { supabase, FormInquiry, Job } from '../../lib/supabase';
import { Inbox, Search, Filter, Eye, Archive, CheckCircle, AlertCircle, Mail, MessageSquare, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { getInquiries, markAsViewed, archiveInquiry, deleteInquiry, getInquiryStats, convertToJob as convertInquiryToJob } from '../../services/inquiryService';
import { useRealtimeInquiries } from '../../hooks/useRealtimeInquiries';
import InquiryDetailModal from '../../components/admin/InquiryDetailModal';
import JobFormModal from '../../components/admin/JobFormModal';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'converted_to_job' | 'archived'>('all');
  const [furnitureTypeFilter, setFurnitureTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<InquiryStats>({ total: 0, pending: 0, converted: 0, archived: 0, conversionRate: 0 });
  const [filteredInquiries, setFilteredInquiries] = useState<FormInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<FormInquiry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobFormData, setJobFormData] = useState<Partial<Job> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { inquiries, unviewedCount, refresh } = useRealtimeInquiries({ businessId });

  useEffect(() => {
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchStats();
    }
  }, [businessId, inquiries]);

  useEffect(() => {
    applyFilters();
  }, [inquiries, searchTerm, statusFilter, furnitureTypeFilter]);

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
      const data = await getInquiryStats(businessId);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const previousCount = inquiries.length;

    try {
      await refresh();
      await fetchStats();
      setLastUpdated(new Date());

      const newCount = inquiries.length;
      const newSubmissions = newCount - previousCount;

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

    if (statusFilter !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.status === statusFilter);
    }

    if (furnitureTypeFilter !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.furniture_type === furnitureTypeFilter);
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

    try {
      await archiveInquiry(id);
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
    };

    setJobFormData(initialData);
    setSelectedInquiry(inquiry);
    setShowDetailModal(false);
    setShowJobModal(true);
  };

  const handleJobSaved = async () => {
    if (!selectedInquiry) return;

    try {
      const { data: createdJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('client_email', selectedInquiry.client_email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (createdJob) {
        await convertInquiryToJob(selectedInquiry.id, createdJob.id);
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Form Inquiries</h1>
            <p className="text-slate-600">Manage customer inquiries from your website contact form</p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`relative px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isRefreshing
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'
            }`}
            title="Check for new form submissions"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Check for New</span>
            {unviewedCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                {unviewedCount}
              </span>
            )}
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Inbox className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Total Inquiries</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Pending</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Converted</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.converted}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ExternalLink className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-slate-600">Conversion Rate</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.conversionRate}%</p>
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
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select name="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
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
              className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow cursor-pointer ${
                !inquiry.viewed ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'
              }`}
              onClick={() => handleViewInquiry(inquiry)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {!inquiry.viewed && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">NEW</span>
                    )}
                    <h3 className="text-xl font-semibold text-slate-900">{inquiry.client_name}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(inquiry.status)}`}>
                      {getStatusLabel(inquiry.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {inquiry.client_email}
                    </span>
                    {inquiry.client_phone && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {inquiry.client_phone}
                      </span>
                    )}
                    <span className="text-slate-500">{formatDate(inquiry.submission_date)}</span>
                    {inquiry.confirmation_code && (
                      <span className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-600 rounded border border-slate-200">
                        {inquiry.confirmation_code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Furniture Type</p>
                  <p className="text-sm font-medium text-slate-900">{inquiry.furniture_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Pieces</p>
                  <p className="text-sm font-medium text-slate-900">{inquiry.pieces}</p>
                </div>
                {inquiry.estimated_price && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Est. Price</p>
                    <p className="text-sm font-medium text-emerald-600">{inquiry.estimated_price}</p>
                  </div>
                )}
                {inquiry.estimated_time && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Est. Time</p>
                    <p className="text-sm font-medium text-slate-900">{inquiry.estimated_time}</p>
                  </div>
                )}
              </div>

              {inquiry.notes && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 line-clamp-2">{inquiry.notes}</p>
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
