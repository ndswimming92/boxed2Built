import { useState } from 'react';
import { ChevronDown, ChevronUp, Save, AlertCircle, Sparkles } from 'lucide-react';
import { OptimizedImage } from '../../utils/imageOptimizationUpload';
import { GalleryService, CreateGalleryItemInput } from '../../services/galleryService';
import { GALLERY_PURPOSE_OPTIONS, GalleryPurpose, purposeToFlags } from '../../utils/galleryPurpose';
import { analyzeGalleryImage } from '../../services/galleryAIService';
import { parseHashtagsInput } from '../../utils/hashtags';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import FocusAreaSelector from './FocusAreaSelector';

interface ImageDetail {
  optimizedImage: OptimizedImage;
  title: string;
  description: string;
  alt: string;
  hashtags: string;
  category: 'before-after' | 'time-lapse' | 'completed-work' | 'process' | 'photos';
  date: string;
  location: string;
  purpose: GalleryPurpose;
  focusX: number;
  focusY: number;
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
      hashtags: '',
      category: 'completed-work' as const,
      date: new Date().toISOString().split('T')[0],
      location: 'Spring Hill, TN',
      purpose: 'both' as GalleryPurpose,
      focusX: 50,
      focusY: 50,
    }))
  );

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);

  const [commonValues, setCommonValues] = useState({
    category: 'completed-work' as const,
    date: new Date().toISOString().split('T')[0],
    location: 'Spring Hill, TN',
    purpose: 'both' as GalleryPurpose,
  });

  const updateImageDetail = (index: number, field: keyof ImageDetail, value: string) => {
    setImageDetails((prev) =>
      prev.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail
      )
    );
  };

  const handleAnalyze = async (index: number) => {
    try {
      setAnalyzingIndex(index);
      setError(null);

      const detail = imageDetails[index];
      const result = await analyzeGalleryImage(detail.optimizedImage.file, {
        location: detail.location,
        category: detail.category,
      });

      setImageDetails((prev) =>
        prev.map((d, i) =>
          i === index
            ? {
                ...d,
                title: result.title,
                description: result.description,
                alt: result.alt,
                hashtags: result.hashtags.join(' '),
              }
            : d
        )
      );
    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setAnalyzingIndex(null);
    }
  };

  const applyCommonValues = () => {
    setImageDetails((prev) =>
      prev.map((detail) => ({
        ...detail,
        category: commonValues.category,
        date: commonValues.date,
        location: commonValues.location,
        purpose: commonValues.purpose,
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
          hashtags: parseHashtagsInput(detail.hashtags),
          category: detail.category,
          date: detail.date || undefined,
          location: detail.location || undefined,
          width: detail.optimizedImage.width,
          height: detail.optimizedImage.height,
          display_order: maxDisplayOrder + i + 1,
          is_active: true,
          focus_x: detail.focusX,
          focus_y: detail.focusY,
          ...purposeToFlags(detail.purpose),
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              <FormField label="Category">
                <select name="category"
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
                <input name="date"
                  type="date"
                  value={commonValues.date}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </FormField>

              <FormField label="Location">
                <input name="location"
                  type="text"
                  value={commonValues.location}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, location: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Spring Hill, TN"
                />
              </FormField>

              <FormField label="Where do these go?">
                <select name="purpose"
                  value={commonValues.purpose}
                  onChange={(e) =>
                    setCommonValues((prev) => ({ ...prev, purpose: e.target.value as GalleryPurpose }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {GALLERY_PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
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
                    <button
                      type="button"
                      onClick={() => handleAnalyze(index)}
                      disabled={analyzingIndex !== null || saving}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzingIndex === index ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Analyze with AI
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField label="Title *" required>
                        <input name="title"
                          type="text"
                          value={detail.title}
                          onChange={(e) => updateImageDetail(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Enter title"
                          required
                        />
                      </FormField>

                      <FormField label="Category *" required>
                        <select name="category"
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
                        <textarea name="description"
                          value={detail.description}
                          onChange={(e) => updateImageDetail(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          rows={3}
                          placeholder="Detailed description for SEO"
                        />
                      </FormField>

                      <FormField label="Alt Text">
                        <input name="alt"
                          type="text"
                          value={detail.alt}
                          onChange={(e) => updateImageDetail(index, 'alt', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Accessibility description"
                        />
                      </FormField>

                      <FormField label="Hashtags" className="md:col-span-2">
                        <input name="hashtags"
                          type="text"
                          value={detail.hashtags}
                          onChange={(e) => updateImageDetail(index, 'hashtags', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="#FurnitureAssembly #IKEAAssembly #SpringHillTN"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Space or comma separated. Appended to the caption when posted to Facebook/Instagram.
                        </p>
                      </FormField>

                      <FormField label="Date">
                        <input name="date"
                          type="date"
                          value={detail.date}
                          onChange={(e) => updateImageDetail(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </FormField>

                      <FormField label="Location">
                        <input name="location"
                          type="text"
                          value={detail.location}
                          onChange={(e) => updateImageDetail(index, 'location', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Spring Hill, TN"
                        />
                      </FormField>

                      <FormField label="Where does this go?">
                        <select name="purpose"
                          value={detail.purpose}
                          onChange={(e) => updateImageDetail(index, 'purpose', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {GALLERY_PURPOSE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </FormField>

                    </div>

                    <div className="mt-4">
                      <FocusAreaSelector
                        imageUrl={detail.optimizedImage.dataUrl}
                        initialFocusX={detail.focusX}
                        initialFocusY={detail.focusY}
                        onFocusChange={(x, y) => {
                          setImageDetails((prev) =>
                            prev.map((d, i) =>
                              i === index ? { ...d, focusX: x, focusY: y } : d
                            )
                          );
                        }}
                      />
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
