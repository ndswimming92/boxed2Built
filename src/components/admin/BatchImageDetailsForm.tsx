import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Save, AlertCircle } from 'lucide-react';
import { OptimizedImage } from '../../utils/imageOptimizationUpload';
import { GalleryService, CreateGalleryItemInput } from '../../services/galleryService';
import Button from '../ui/Button';
import FormField from '../ui/FormField';

interface ImageDetail {
  optimizedImage: OptimizedImage;
  title: string;
  description: string;
  alt: string;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date: string;
  location: string;
  amazonLink: string;
}

interface BatchImageDetailsFormProps {
  optimizedImages: OptimizedImage[];
  businessId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function BatchImageDetailsForm({
  optimizedImages,
  businessId,
  onComplete,
  onCancel,
}: BatchImageDetailsFormProps) {
  const [imageDetails, setImageDetails] = useState<ImageDetail[]>(
    optimizedImages.map((img) => ({
      optimizedImage: img,
      title: img.file.name.replace(/\.[^.]+$/, ''),
      description: '',
      alt: '',
      category: 'completed-work' as const,
      date: new Date().toISOString().split('T')[0],
      location: 'Spring Hill, TN',
      amazonLink: '',
    }))
  );

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [commonValues, setCommonValues] = useState({
    category: 'completed-work' as const,
    date: new Date().toISOString().split('T')[0],
    location: 'Spring Hill, TN',
  });

  const updateImageDetail = (index: number, field: keyof ImageDetail, value: string) => {
    setImageDetails((prev) =>
      prev.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail
      )
    );
  };

  const applyCommonValues = () => {
    setImageDetails((prev) =>
      prev.map((detail) => ({
        ...detail,
        category: commonValues.category,
        date: commonValues.date,
        location: commonValues.location,
      }))
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setUploadProgress({ current: 0, total: imageDetails.length });

      const maxDisplayOrder = await GalleryService.getMaxDisplayOrder(businessId);

      const galleryItemInputs: CreateGalleryItemInput[] = [];

      for (let i = 0; i < imageDetails.length; i++) {
        const detail = imageDetails[i];

        setUploadProgress({ current: i + 1, total: imageDetails.length });

        const imageUrl = await GalleryService.uploadImage(
          detail.optimizedImage,
          businessId
        );

        galleryItemInputs.push({
          business_id: businessId,
          type: 'image',
          src: imageUrl,
          title: detail.title,
          description: detail.description || undefined,
          alt: detail.alt || detail.title,
          category: detail.category,
          date: detail.date || undefined,
          location: detail.location || undefined,
          width: detail.optimizedImage.width,
          height: detail.optimizedImage.height,
          amazon_link: detail.amazonLink || undefined,
          display_order: maxDisplayOrder + i + 1,
          is_active: true,
        });
      }

      await GalleryService.batchCreateGalleryItems(galleryItemInputs);

      onComplete();
    } catch (err) {
      console.error('Error saving gallery items:', err);
      setError(err instanceof Error ? err.message : 'Failed to save gallery items');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Add Details for {imageDetails.length} Image{imageDetails.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Fill in the details for each image or apply common values to all
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {saving && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm font-medium text-blue-900">
                Uploading and saving... {uploadProgress.current} of {uploadProgress.total}
              </p>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Apply Common Values to All Images
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <FormField label="Category">
                <select
                  value={commonValues.category}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, category: e.target.value as any }))
                  }
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
                  value={commonValues.date}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </FormField>

              <FormField label="Location">
                <input
                  type="text"
                  value={commonValues.location}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, location: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Spring Hill, TN"
                />
              </FormField>
            </div>
            <Button onClick={applyCommonValues} variant="outline" size="sm">
              Apply to All Images
            </Button>
          </div>

          <div className="space-y-3">
            {imageDetails.map((detail, index) => (
              <div
                key={index}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <img
                    src={detail.optimizedImage.dataUrl}
                    alt={detail.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">{detail.title || 'Untitled'}</p>
                    <p className="text-sm text-slate-500">
                      {detail.optimizedImage.width} × {detail.optimizedImage.height} •{' '}
                      {(detail.optimizedImage.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {expandedIndex === index ? (
                    <ChevronUp className="text-slate-400" size={20} />
                  ) : (
                    <ChevronDown className="text-slate-400" size={20} />
                  )}
                </button>

                {expandedIndex === index && (
                  <div className="px-4 pb-4 border-t border-slate-200 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField label="Title *" required>
                        <input
                          type="text"
                          value={detail.title}
                          onChange={(e) => updateImageDetail(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Enter title"
                          required
                        />
                      </FormField>

                      <FormField label="Category *" required>
                        <select
                          value={detail.category}
                          onChange={(e) => updateImageDetail(index, 'category', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="completed-work">Completed Work</option>
                          <option value="before-after">Before & After</option>
                          <option value="process">Process</option>
                          <option value="photos">Photos</option>
                          <option value="time-lapse">Time-lapse</option>
                        </select>
                      </FormField>

                      <FormField label="Description" className="md:col-span-2">
                        <textarea
                          value={detail.description}
                          onChange={(e) => updateImageDetail(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          rows={3}
                          placeholder="Detailed description for SEO"
                        />
                      </FormField>

                      <FormField label="Alt Text">
                        <input
                          type="text"
                          value={detail.alt}
                          onChange={(e) => updateImageDetail(index, 'alt', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Accessibility description"
                        />
                      </FormField>

                      <FormField label="Date">
                        <input
                          type="date"
                          value={detail.date}
                          onChange={(e) => updateImageDetail(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </FormField>

                      <FormField label="Location">
                        <input
                          type="text"
                          value={detail.location}
                          onChange={(e) => updateImageDetail(index, 'location', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Spring Hill, TN"
                        />
                      </FormField>

                      <FormField label="Amazon Affiliate Link">
                        <input
                          type="url"
                          value={detail.amazonLink}
                          onChange={(e) => updateImageDetail(index, 'amazonLink', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="https://amzn.to/..."
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
                Save All Images
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
