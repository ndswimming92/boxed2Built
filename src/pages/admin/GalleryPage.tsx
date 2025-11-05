import React, { useState, useEffect } from 'react';
import { Image, Video, Plus, Edit2, Trash2, Eye, EyeOff, Upload, Search, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGalleryItems } from '../../hooks/useGalleryItems';
import { GalleryService } from '../../services/galleryService';
import type { GalleryItem } from '../../services/galleryService';
import { OptimizedImage } from '../../utils/imageOptimizationUpload';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import BatchImageUpload from '../../components/admin/BatchImageUpload';
import BatchImageDetailsForm from '../../components/admin/BatchImageDetailsForm';
import GalleryItemModal from '../../components/admin/GalleryItemModal';

export default function GalleryPage() {
  const { user } = useAuth();
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
      await GalleryService.updateGalleryItem(item.id, { is_active: !item.is_active });
      refresh();
    } catch (err) {
      console.error('Error toggling item status:', err);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gallery Management</h1>
          <p className="text-slate-600 mt-1">Manage images and videos for the public gallery</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowBatchUpload(true)}
            variant="primary"
          >
            <Upload size={18} className="mr-2" />
            Upload Images
          </Button>
          <Button
            onClick={() => {
              setEditingItem(undefined);
              setShowItemModal(true);
            }}
            variant="outline"
          >
            <Plus size={18} className="mr-2" />
            Add Single Item
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or description"
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <select
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

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>

          <select
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
                <p className="text-xs text-slate-500 mb-2 capitalize">
                  {item.category.replace('-', ' ')}
                </p>

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
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      item.is_active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {item.is_active ? (
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
