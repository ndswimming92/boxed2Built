import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, JobCompletion } from '../../lib/supabase';
import { CheckCircle2, Star, Eye, Calendar, User, DollarSign, Search, Filter, X, Image as ImageIcon, Download, Share2, ExternalLink } from 'lucide-react';
import { downloadPhoto, sharePhoto, openPhotoInNewTab, isIOS, canShare } from '../../utils/photoDownload';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export default function CompletionsPage() {
  const [completions, setCompletions] = useState<(JobCompletion & { job: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [satisfactionFilter, setSatisfactionFilter] = useState<'all' | 'satisfied' | 'unsatisfied'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompletion, setSelectedCompletion] = useState<(JobCompletion & { job: any }) | null>(null);
  const [selectedCompletionDetail, setSelectedCompletionDetail] = useState<(JobCompletion & { job: any }) | null>(null);
  const detailCache = useRef<Map<string, JobCompletion & { job: any }>>(new Map());

  const fetchData = useCallback(async (
    targetPage: number,
    reset = false,
    activeSearchTerm = '',
    activeSatisfactionFilter: 'all' | 'satisfied' | 'unsatisfied' = 'all'
  ) => {
    const start = (targetPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    if (targetPage === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('job_completions')
        .select(`
          id,
          completed_at,
          customer_name,
          is_customer_satisfied,
          final_price,
          completion_checklist,
          photo_count,
          job_id,
          job:jobs!job_id (
            client_phone,
            final_price,
            payment_date,
            job_type
          )
        `, { count: 'exact' })
        .order('completed_at', { ascending: false })
        .range(start, end);

      const trimmedSearchTerm = activeSearchTerm.trim();
      if (trimmedSearchTerm) {
        query = query.or(`customer_name.ilike.%${trimmedSearchTerm}%,jobs.client_phone.ilike.%${trimmedSearchTerm}%`);
      }

      if (activeSatisfactionFilter === 'satisfied') {
        query = query.eq('is_customer_satisfied', true);
      } else if (activeSatisfactionFilter === 'unsatisfied') {
        query = query.eq('is_customer_satisfied', false);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching completions:', error);
        throw error;
      }

      if (typeof count === 'number') {
        setTotalCount(count);
        setHasMore(end + 1 < count);
      } else {
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }

      if (data) {
        if (reset) {
          setCompletions(data);
        } else {
          setCompletions(prev => [...prev, ...data]);
        }
      } else if (reset) {
        setCompletions([]);
      }

      setPage(targetPage);
    } catch (error) {
      console.error('Error fetching completions:', error);
    } finally {
      if (targetPage === 1) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    fetchData(1, true, debouncedSearchTerm, satisfactionFilter);
  }, [debouncedSearchTerm, fetchData, satisfactionFilter]);

  useEffect(() => {
    if (!selectedCompletion?.id) {
      setSelectedCompletionDetail(null);
      setDetailLoading(false);
      return;
    }

    const cached = detailCache.current.get(selectedCompletion.id);
    if (cached) {
      setSelectedCompletionDetail(cached);
      setDetailLoading(false);
      return;
    }

    const fetchCompletionDetail = async () => {
      setDetailLoading(true);
      try {
        const { data, error } = await supabase
          .from('job_completions')
          .select(`
            id,
            job_id,
            completed_at,
            completed_by,
            signature_data,
            signature_url,
            completion_checklist,
            completion_photos,
            admin_notes,
            device_info,
            customer_name,
            final_price,
            is_customer_satisfied,
            location_captured,
            created_at,
            updated_at,
            job:jobs!job_id (
              client_phone,
              final_price,
              payment_date,
              job_type
            )
          `)
          .eq('id', selectedCompletion.id)
          .single();

        if (error) {
          console.error('Error fetching completion detail:', error);
          return;
        }

        if (data) {
          detailCache.current.set(data.id, data);
          setSelectedCompletionDetail(data);
        }
      } catch (error) {
        console.error('Error fetching completion detail:', error);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchCompletionDetail();
  }, [selectedCompletion?.id]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchData(page + 1, false, debouncedSearchTerm, satisfactionFilter);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCheckedCount = (checklist: any) => {
    if (!Array.isArray(checklist)) return { checked: 0, total: 0 };
    return {
      checked: checklist.filter((item: any) => item.checked).length,
      total: checklist.length,
    };
  };

  const handleDownloadPhoto = (photoUrl: string, completion: JobCompletion & { job: any }, index: number) => {
    const timestamp = new Date(completion.completed_at).toISOString().split('T')[0];
    const sanitizedClientName = (completion.customer_name || 'customer').replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;
    downloadPhoto(photoUrl, filename);
  };

  const handleSharePhoto = async (photoUrl: string, completion: JobCompletion & { job: any }, index: number) => {
    const timestamp = new Date(completion.completed_at).toISOString().split('T')[0];
    const sanitizedClientName = (completion.customer_name || 'customer').replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;

    const shared = await sharePhoto(photoUrl, filename);
    if (!shared) {
      downloadPhoto(photoUrl, filename);
    }
  };

  const handleDownloadAllPhotos = (completion: JobCompletion & { job: any }) => {
    if (!completion.completion_photos || completion.completion_photos.length === 0) return;

    const timestamp = new Date(completion.completed_at).toISOString().split('T')[0];
    const sanitizedClientName = (completion.customer_name || 'customer').replace(/[^a-zA-Z0-9]/g, '-');

    completion.completion_photos.forEach((photo, index) => {
      const filename = `job-completion-${sanitizedClientName}-${timestamp}-photo-${index + 1}.jpg`;
      setTimeout(() => {
        downloadPhoto(photo, filename);
      }, index * 200);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const modalCompletion = selectedCompletionDetail ?? selectedCompletion;

  return (
    <div className="max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Job Completions</h1>
        <p className="text-sm sm:text-base text-slate-600">View all completed jobs with customer signatures</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input name="searchTerm"
              type="text"
              placeholder="Search by customer name or phone..."
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
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">Customer Satisfaction</label>
            <select name="satisfactionFilter"
              value={satisfactionFilter}
              onChange={(e) => setSatisfactionFilter(e.target.value as any)}
              className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Completions</option>
              <option value="satisfied">Satisfied Customers</option>
              <option value="unsatisfied">Unsatisfied Customers</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Completions</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{totalCount}</p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Satisfied</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {completions.filter(c => c.is_customer_satisfied).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {completions.length > 0
              ? `${Math.round((completions.filter(c => c.is_customer_satisfied).length / completions.length) * 100)}%`
              : '0%'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 border border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Total Value</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            ${completions.reduce((sum, c) => sum + (c.final_price || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mb-3 text-sm text-slate-600">
        Showing {completions.length} of {totalCount} completions
      </div>

      <div className="space-y-4">
        {completions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">
              No completions match your filters
            </p>
          </div>
        ) : (
          completions.map((completion) => {
            const checklist = getCheckedCount(completion.completion_checklist);
            return (
              <div
                key={completion.id}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedCompletion(completion)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-semibold text-slate-900">{completion.customer_name}</h3>
                      {completion.is_customer_satisfied ? (
                        <span className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold rounded-full border bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Satisfied
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold rounded-full border bg-yellow-100 text-yellow-800 border-yellow-200">
                          Needs Follow-up
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(completion.completed_at)}
                      </div>
                      {completion.job?.client_phone && (
                        <span>{completion.job.client_phone}</span>
                      )}
                    </div>
                  </div>
                  <button className="self-start px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Final Price</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {completion.job?.final_price != null ? `$${Number(completion.job.final_price).toLocaleString()}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Payment</p>
                    {completion.job?.payment_date ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Unpaid
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Checklist</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {checklist.checked}/{checklist.total} items
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Photos</p>
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      {(completion as any).photo_count ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Signature</p>
                    <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Captured
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {selectedCompletion && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{modalCompletion?.customer_name}</h2>
                <p className="text-sm text-slate-600 mt-1">Completed on {modalCompletion?.completed_at ? formatDate(modalCompletion.completed_at) : 'N/A'}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCompletion(null);
                  setSelectedCompletionDetail(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Loading full completion details...
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Completion Summary
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Final Price</p>
                    <p className="font-semibold text-slate-900">
                      {modalCompletion?.job?.final_price != null ? `$${Number(modalCompletion.job.final_price).toLocaleString()}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Payment Status</p>
                    {modalCompletion?.job?.payment_date ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Unpaid
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-600">Customer Satisfied</p>
                    <p className={`font-semibold ${modalCompletion?.is_customer_satisfied ? 'text-green-600' : 'text-yellow-600'}`}>
                      {modalCompletion?.is_customer_satisfied ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Completed By</p>
                    <p className="font-semibold text-slate-900 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Admin
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Job Type</p>
                    <p className="font-semibold text-slate-900">{modalCompletion?.job?.job_type || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {Array.isArray(modalCompletion?.completion_checklist) && modalCompletion.completion_checklist.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Completion Checklist
                  </h3>
                  <div className="space-y-2">
                    {modalCompletion.completion_checklist.map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <CheckCircle2 className={`w-5 h-5 ${item.checked ? 'text-emerald-600' : 'text-slate-300'}`} />
                        <span className={`text-sm ${item.checked ? 'text-slate-900' : 'text-slate-500'}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Customer Signature</h3>
                <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
                  {modalCompletion?.signature_data ? (
                    <img
                      src={modalCompletion.signature_data}
                      alt="Customer signature"
                      className="max-w-full h-48 mx-auto"
                    />
                  ) : (
                    <p className="text-sm text-slate-600 text-center py-10">
                      {detailLoading ? 'Loading signature...' : 'No signature available.'}
                    </p>
                  )}
                </div>
              </div>

              {modalCompletion?.completion_photos && modalCompletion.completion_photos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                      Completion Photos ({modalCompletion.completion_photos.length})
                    </h3>
                    {!isIOS() && (
                      <button
                        onClick={() => handleDownloadAllPhotos(modalCompletion)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Save All
                      </button>
                    )}
                  </div>
                  {isIOS() && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-900 font-medium mb-1">iPhone Users:</p>
                      <p className="text-xs text-blue-800">
                        Tap "Save to Photos" on each image or use "Open & Save" to view full size and long-press to save
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {modalCompletion.completion_photos.map((photo, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg overflow-hidden">
                        <img
                          src={photo}
                          alt={`Completion photo ${index + 1}`}
                          className="w-full h-48 object-cover"
                        />
                        <div className="p-2 flex gap-2 flex-wrap">
                          {canShare() && (
                            <button
                              onClick={() => handleSharePhoto(photo, modalCompletion, index)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              {isIOS() ? 'Save to Photos' : 'Share'}
                            </button>
                          )}
                          {isIOS() ? (
                            <button
                              onClick={() => openPhotoInNewTab(photo)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open & Save
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownloadPhoto(photo, modalCompletion, index)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modalCompletion?.admin_notes && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Admin Notes</h3>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg">
                    {modalCompletion.admin_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setSelectedCompletion(null);
                  setSelectedCompletionDetail(null);
                }}
                className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
