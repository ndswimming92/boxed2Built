import { useState, useEffect } from 'react';
import { Image, Video, Plus, CreditCard as Edit2, Trash2, Eye, EyeOff, Upload, Search, ArrowUpDown, Share2, Facebook, Instagram, Youtube, CheckCircle2, AlertCircle, ShieldAlert, Clock, X } from 'lucide-react';
import { useGalleryItems } from '../../hooks/useGalleryItems';
import { GalleryService } from '../../services/galleryService';
import type { GalleryItem } from '../../services/galleryService';
import { publishGalleryPhoto, checkSocialPostStatus, YoutubeUploadResult } from '../../services/socialPublishService';
import { OptimizedImage } from '../../utils/imageOptimizationUpload';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import BatchImageUpload from '../../components/admin/BatchImageUpload';
import BatchImageDetailsForm from '../../components/admin/BatchImageDetailsForm';
import GalleryItemModal from '../../components/admin/GalleryItemModal';
import GalleryReorderGrid from '../../components/admin/GalleryReorderGrid';
import YoutubeUploadModal from '../../components/admin/YoutubeUploadModal';

const isPostedToFacebook = (item: GalleryItem) => Boolean(item.facebook_posted_at);
const isPostedToInstagram = (item: GalleryItem) => Boolean(item.instagram_posted_at);
const isFacebookRemoved = (item: GalleryItem) => Boolean(item.facebook_post_removed_at);
const isInstagramRemoved = (item: GalleryItem) => Boolean(item.instagram_post_removed_at);

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function GalleryPage() {
  const [businessId, setBusinessId] = useState<string>('');
  const [loadingBusinessId, setLoadingBusinessId] = useState(true);
  const { items, loading, error, refresh } = useGalleryItems(businessId, true);

  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [optimizedImages, setOptimizedImages] = useState<OptimizedImage[] | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | undefined>(undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [schedulingBusyId, setSchedulingBusyId] = useState<string | null>(null);
  const [showYoutubeUpload, setShowYoutubeUpload] = useState(false);

  useEffect(() => {
    const fetchBusinessId = async () => {
      try {
        setLoadingBusinessId(true);
        const { data } = await supabase
          .from('business_info')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();
        if (data) setBusinessId(data.id);
      } catch (err) {
        console.error('Error fetching business ID:', err);
      } finally {
        setLoadingBusinessId(false);
      }
    };
    fetchBusinessId();
  }, []);

  useEffect(() => {
    if (!businessId) return;
    checkSocialPostStatus()
      .then((result) => {
        if (result.facebook_removed.length > 0 || result.instagram_removed.length > 0) {
          refresh();
        }
      })
      .catch((err) => console.error('Error checking social post status:', err));
    // Runs once per page load to flag posts Facebook/Instagram took down after publishing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && item.is_active) ||
                         (filterStatus === 'inactive' && !item.is_active);

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const handleImagesOptimized = (images: OptimizedImage[]) => {
    setOptimizedImages(images);
    setShowBatchUpload(false);
  };

  const handleBatchComplete = () => {
    setOptimizedImages(null);
    refresh();
  };

  const handleItemSaved = () => {
    setShowItemModal(false);
    setEditingItem(undefined);
    refresh();
  };

  const handleEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleToggleActive = async (item: GalleryItem) => {
    try {
      setTogglingId(item.id);
      await GalleryService.updateGalleryItem(item.id, { is_active: !item.is_active });
      await refresh();
    } catch (err) {
      console.error('Error toggling item status:', err);
      alert(`Failed to toggle visibility: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handlePostToSocial = async (item: GalleryItem) => {
    try {
      setPublishingId(item.id);
      const result = await publishGalleryPhoto(item.id);
      const parts: string[] = [];
      if (result.facebook.success) parts.push('Facebook: posted');
      else parts.push(`Facebook: ${result.facebook.error ?? 'failed'}`);
      if (result.instagram.success) parts.push('Instagram: posted');
      else parts.push(`Instagram: ${result.instagram.error ?? 'failed'}`);

      setPublishMessage({
        type: result.facebook.success || result.instagram.success ? 'success' : 'error',
        text: parts.join(' · '),
      });
      await refresh();
    } catch (err) {
      console.error('Error posting to social:', err);
      setPublishMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to post to social media.' });
    } finally {
      setPublishingId(null);
      setTimeout(() => setPublishMessage(null), 6000);
    }
  };

  const handleOpenSchedule = (item: GalleryItem) => {
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    setScheduleValue(toDatetimeLocalValue(defaultTime));
    setSchedulingId(item.id);
  };

  const handleConfirmSchedule = async (item: GalleryItem) => {
    if (!scheduleValue) return;
    const scheduledDate = new Date(scheduleValue);
    if (scheduledDate.getTime() <= Date.now()) {
      setPublishMessage({ type: 'error', text: 'Pick a time in the future to schedule a post.' });
      setTimeout(() => setPublishMessage(null), 6000);
      return;
    }
    try {
      setSchedulingBusyId(item.id);
      await GalleryService.updateGalleryItem(item.id, {
        social_scheduled_at: scheduledDate.toISOString(),
      });
      setSchedulingId(null);
      await refresh();
    } catch (err) {
      console.error('Error scheduling post:', err);
      setPublishMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to schedule post.' });
      setTimeout(() => setPublishMessage(null), 6000);
    } finally {
      setSchedulingBusyId(null);
    }
  };

  const handleCancelScheduledPost = async (item: GalleryItem) => {
    try {
      setSchedulingBusyId(item.id);
      await GalleryService.updateGalleryItem(item.id, { social_scheduled_at: null });
      await refresh();
    } catch (err) {
      console.error('Error cancelling scheduled post:', err);
      setPublishMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to cancel scheduled post.' });
      setTimeout(() => setPublishMessage(null), 6000);
    } finally {
      setSchedulingBusyId(null);
    }
  };

  const handleYoutubeUploaded = async (result: YoutubeUploadResult, title: string, description: string) => {
    try {
      await GalleryService.createGalleryItem({
        business_id: businessId,
        type: 'video',
        platform: 'youtube',
        src: result.videoUrl,
        title,
        description: description || undefined,
        category: 'completed-work',
      });
      await refresh();
      setPublishMessage({ type: 'success', text: 'Video uploaded to YouTube and added to your gallery.' });
    } catch (err) {
      console.error('Error adding YouTube video to gallery:', err);
      setPublishMessage({ type: 'error', text: 'Uploaded to YouTube, but could not add it to your gallery automatically. Add it manually with "Add Single Item".' });
    }
    setTimeout(() => setPublishMessage(null), 6000);
  };

  const handleDelete = async (id: string, permanent = false) => {
    try {
      setDeleting(true);
      await GalleryService.deleteGalleryItem(id, permanent);
      setShowDeleteConfirm(null);
      refresh();
    } catch (err) {
      console.error('Error deleting item:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loadingBusinessId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">Unable to load business information. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gallery Management</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Manage images and videos for the public gallery</p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          {!reorderMode && (
            <Button
              onClick={() => setReorderMode(true)}
              variant="outline"
              disabled={items.length < 2}
            >
              <ArrowUpDown size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Reorder</span>
            </Button>
          )}
          <Button
            onClick={() => setShowBatchUpload(true)}
            variant="primary"
          >
            <Upload size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Upload Images</span>
            <span className="sm:hidden">Upload</span>
          </Button>
          <Button
            onClick={() => {
              setEditingItem(undefined);
              setShowItemModal(true);
            }}
            variant="outline"
          >
            <Plus size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Add Single Item</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button
            onClick={() => setShowYoutubeUpload(true)}
            variant="outline"
          >
            <Youtube size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Upload to YouTube</span>
            <span className="sm:hidden">YouTube</span>
          </Button>
        </div>
      </div>

      {publishMessage && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${publishMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {publishMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
          <p className={`text-sm ${publishMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{publishMessage.text}</p>
        </div>
      )}

      {reorderMode ? (
        <GalleryReorderGrid
          items={items}
          onDone={() => {
            setReorderMode(false);
            refresh();
          }}
        />
      ) : (
      <>
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input name="searchTerm"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or description"
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <select name="filterCategory"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            <option value="completed-work">Completed Work</option>
            <option value="before-after">Before & After</option>
            <option value="process">Process</option>
            <option value="photos">Photos</option>
            <option value="time-lapse">Time-lapse</option>
          </select>

          <select name="filterType"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>

          <select name="filterStatus"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📸</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No gallery items found</h3>
          <p className="text-slate-600 mb-4">
            {items.length === 0
              ? 'Get started by uploading your first images or adding a video.'
              : 'Try adjusting your filters to see more items.'}
          </p>
          {items.length === 0 && (
            <Button onClick={() => setShowBatchUpload(true)} variant="primary">
              <Upload size={18} className="mr-2" />
              Upload First Images
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg border-2 overflow-hidden transition-all hover:shadow-md ${
                item.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="relative aspect-square bg-slate-100">
                {item.type === 'image' ? (
                  <img
                    src={item.src}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <Video size={48} className="text-white" />
                  </div>
                )}
                {!item.is_active && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Inactive
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  {item.type === 'image' ? (
                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                      <Image size={12} className="inline mr-1" />
                      Image
                    </span>
                  ) : (
                    <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">
                      <Video size={12} className="inline mr-1" />
                      Video
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3">
                <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 mb-1 capitalize">
                  {item.category.replace('-', ' ')}
                </p>
                {item.type === 'image' && (
                  <span className={`inline-block mb-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    !item.show_on_website
                      ? 'bg-purple-100 text-purple-700'
                      : !item.eligible_for_social
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {!item.show_on_website
                      ? 'Social Only'
                      : !item.eligible_for_social
                        ? 'Website Only'
                        : 'Website + Social'}
                  </span>
                )}
                {item.description && (
                  <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                    {item.description.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                      if (part.match(/^https?:\/\//)) {
                        return (
                          <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {part.length > 30 ? part.substring(0, 30) + '...' : part}
                          </a>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    })}
                  </p>
                )}

                {item.type === 'image' && (isPostedToFacebook(item) || isPostedToInstagram(item)) && (
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    {isPostedToFacebook(item) && (
                      isFacebookRemoved(item) ? (
                        <span className="inline-flex items-center gap-1 text-red-700" title={item.facebook_post_removed_reason || 'Facebook removed this post'}>
                          <ShieldAlert size={12} /> Removed by Facebook
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700" title="Posted to Facebook">
                          <Facebook size={12} /> Posted
                        </span>
                      )
                    )}
                    {isPostedToInstagram(item) && (
                      isInstagramRemoved(item) ? (
                        <span className="inline-flex items-center gap-1 text-red-700" title={item.instagram_post_removed_reason || 'Instagram removed this post'}>
                          <ShieldAlert size={12} /> Removed by Instagram
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-pink-700" title="Posted to Instagram">
                          <Instagram size={12} /> Posted
                        </span>
                      )
                    )}
                  </div>
                )}
                {item.type === 'image' && (isFacebookRemoved(item) || isInstagramRemoved(item)) && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2 line-clamp-3">
                    {isFacebookRemoved(item) && `Facebook took this post down, likely for spam/policy reasons${item.facebook_post_removed_reason ? ` — ${item.facebook_post_removed_reason}` : ''}.`}
                    {isFacebookRemoved(item) && isInstagramRemoved(item) && ' '}
                    {isInstagramRemoved(item) && `Instagram took this post down, likely for spam/policy reasons${item.instagram_post_removed_reason ? ` — ${item.instagram_post_removed_reason}` : ''}.`}
                  </p>
                )}
                {item.type === 'image' && (item.facebook_post_error || item.instagram_post_error) && (
                  <p className="text-xs text-red-600 mb-2 line-clamp-2">
                    {item.facebook_post_error && `Facebook: ${item.facebook_post_error}`}
                    {item.facebook_post_error && item.instagram_post_error && ' · '}
                    {item.instagram_post_error && `Instagram: ${item.instagram_post_error}`}
                  </p>
                )}

                {item.type === 'image' && item.eligible_for_social && item.social_scheduled_at && (
                  <div className="w-full mb-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs font-medium text-amber-800 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 truncate">
                      <Clock size={12} className="flex-shrink-0" />
                      Scheduled {formatScheduledTime(item.social_scheduled_at)}
                    </span>
                    <button
                      onClick={() => handleCancelScheduledPost(item)}
                      disabled={schedulingBusyId === item.id}
                      className="flex-shrink-0 text-amber-700 hover:text-amber-900 disabled:opacity-50"
                      title="Cancel scheduled post"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {item.type === 'image' && item.eligible_for_social && !item.social_scheduled_at && schedulingId === item.id && (
                  <div className="w-full mb-1.5 flex flex-col gap-1.5">
                    <input
                      type="datetime-local"
                      value={scheduleValue}
                      min={toDatetimeLocalValue(new Date())}
                      onChange={(e) => setScheduleValue(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleConfirmSchedule(item)}
                        disabled={schedulingBusyId === item.id}
                        className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {schedulingBusyId === item.id ? 'Saving…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setSchedulingId(null)}
                        className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {item.type === 'image' && item.eligible_for_social && !item.social_scheduled_at && schedulingId !== item.id && (
                  <div className="w-full mb-1.5 flex gap-1.5">
                    <button
                      onClick={() => handlePostToSocial(item)}
                      disabled={publishingId === item.id}
                      className="flex-1 px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Share2 size={12} />
                      {publishingId === item.id ? 'Posting…' : 'Post Now'}
                    </button>
                    <button
                      onClick={() => handleOpenSchedule(item)}
                      className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Clock size={12} />
                      Schedule
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                  >
                    <Edit2 size={12} className="inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingId === item.id}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      item.is_active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {togglingId === item.id ? (
                      'Updating...'
                    ) : item.is_active ? (
                      <>
                        <EyeOff size={12} className="inline mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye size={12} className="inline mr-1" />
                        Show
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(item.id)}
                    className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {showBatchUpload && (
        <BatchImageUpload
          onImagesOptimized={handleImagesOptimized}
          onCancel={() => setShowBatchUpload(false)}
        />
      )}

      {optimizedImages && (
        <BatchImageDetailsForm
          optimizedImages={optimizedImages}
          businessId={businessId}
          onComplete={handleBatchComplete}
          onCancel={() => setOptimizedImages(null)}
        />
      )}

      {showItemModal && (
        <GalleryItemModal
          businessId={businessId}
          item={editingItem}
          onSave={handleItemSaved}
          onCancel={() => {
            setShowItemModal(false);
            setEditingItem(undefined);
          }}
        />
      )}

      {showYoutubeUpload && (
        <YoutubeUploadModal
          onClose={() => setShowYoutubeUpload(false)}
          onUploaded={handleYoutubeUploaded}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Gallery Item?</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowDeleteConfirm(null)}
                variant="outline"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(showDeleteConfirm, true)}
                variant="primary"
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
