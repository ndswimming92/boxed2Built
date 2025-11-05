import React, { useState, useEffect } from 'react';
import { X, Save, Upload, Video, AlertCircle } from 'lucide-react';
import { GalleryService, CreateGalleryItemInput, UpdateGalleryItemInput } from '../../services/galleryService';
import type { GalleryItem } from '../../services/galleryService';
import { optimizeImage, validateImageFile } from '../../utils/imageOptimizationUpload';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

interface GalleryItemModalProps {
  businessId: string;
  item?: GalleryItem;
  onSave: () => void;
  onCancel: () => void;
}

export default function GalleryItemModal({ businessId, item, onSave, onCancel }: GalleryItemModalProps) {
  const isEdit = !!item;
  const [type, setType] = useState<'image' | 'video'>(item?.type || 'image');
  const [formData, setFormData] = useState({
    title: item?.title || '',
    description: item?.description || '',
    alt: item?.alt || '',
    category: item?.category || 'completed-work' as const,
    date: item?.date || new Date().toISOString().split('T')[0],
    location: item?.location || 'Spring Hill, TN',
    amazonLink: item?.amazon_link || '',
    youtubeUrl: item?.type === 'video' ? item.src : '',
    width: item?.width || undefined,
    height: item?.height || undefined,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(item?.src || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (type === 'image' && !isEdit && !selectedFile) {
      setError('Please select an image file');
      return;
    }

    if (type === 'video' && !formData.youtubeUrl.trim()) {
      setError('YouTube URL is required for video items');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let imageSrc = item?.src || '';
      let width = formData.width;
      let height = formData.height;

      if (type === 'image' && selectedFile) {
        const optimized = await optimizeImage(selectedFile, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.85,
          convertToWebP: true,
        });

        imageSrc = await GalleryService.uploadImage(optimized, businessId);
        width = optimized.width;
        height = optimized.height;
      } else if (type === 'video') {
        const videoId = extractYouTubeId(formData.youtubeUrl);
        if (!videoId) {
          setError('Invalid YouTube URL');
          setSaving(false);
          return;
        }
        imageSrc = `https://youtu.be/${videoId}`;
      }

      if (isEdit) {
        const updateData: UpdateGalleryItemInput = {
          title: formData.title,
          description: formData.description || undefined,
          alt: formData.alt || undefined,
          category: formData.category,
          date: formData.date || undefined,
          location: formData.location || undefined,
          amazon_link: formData.amazonLink || undefined,
          width,
          height,
        };

        if (type === 'image' && selectedFile) {
          updateData.platform = undefined;
        }

        await GalleryService.updateGalleryItem(item.id, updateData);
      } else {
        const maxDisplayOrder = await GalleryService.getMaxDisplayOrder(businessId);

        const createData: CreateGalleryItemInput = {
          business_id: businessId,
          type,
          src: imageSrc,
          title: formData.title,
          description: formData.description || undefined,
          alt: formData.alt || formData.title,
          category: formData.category,
          date: formData.date || undefined,
          location: formData.location || undefined,
          width,
          height,
          amazon_link: formData.amazonLink || undefined,
          platform: type === 'video' ? 'youtube' : undefined,
          display_order: maxDisplayOrder + 1,
          is_active: true,
        };

        await GalleryService.createGalleryItem(createData);
      }

      onSave();
    } catch (err) {
      console.error('Error saving gallery item:', err);
      setError(err instanceof Error ? err.message : 'Failed to save gallery item');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Edit Gallery Item' : 'Add Gallery Item'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
            disabled={saving}
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {!isEdit && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setType('image')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    type === 'image'
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Upload size={24} className="mx-auto mb-1 text-slate-600" />
                  <p className="font-medium text-slate-900">Image</p>
                </button>
                <button
                  onClick={() => setType('video')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    type === 'video'
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Video size={24} className="mx-auto mb-1 text-slate-600" />
                  <p className="font-medium text-slate-900">Video</p>
                </button>
              </div>
            </div>
          )}

          {type === 'image' && (
            <div className="mb-6">
              <FormField label={isEdit ? 'Change Image (optional)' : 'Image *'} required={!isEdit}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </FormField>
              {previewUrl && (
                <div className="mt-3">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border border-slate-200"
                  />
                </div>
              )}
            </div>
          )}

          {type === 'video' && (
            <FormField label="YouTube URL *" required className="mb-6">
              <input
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://youtu.be/..."
                disabled={isEdit}
              />
            </FormField>
          )}

          <div className="space-y-4">
            <FormField label="Title *" required>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter title"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
                placeholder="Detailed description for SEO"
              />
            </FormField>

            <FormField label="Alt Text">
              <input
                type="text"
                value={formData.alt}
                onChange={(e) => setFormData({ ...formData, alt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Accessibility description"
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Category *" required>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="completed-work">Completed Work</option>
                  <option value="before-after">Before & After</option>
                  <option value="process">Process</option>
                  <option value="photos">Photos</option>
                  <option value="time-lapse">Time-lapse</option>
                </select>
              </FormField>

              <FormField label="Date">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </FormField>
            </div>

            <FormField label="Location">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Spring Hill, TN"
              />
            </FormField>

            <FormField label="Amazon Affiliate Link">
              <input
                type="url"
                value={formData.amazonLink}
                onChange={(e) => setFormData({ ...formData, amazonLink: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://amzn.to/..."
              />
            </FormField>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button onClick={onCancel} variant="outline" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                {isEdit ? 'Update' : 'Create'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
