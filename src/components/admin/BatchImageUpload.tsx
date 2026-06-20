import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { optimizeImages, validateImageFiles, snapshotFileToMemory, OptimizedImage } from '../../utils/imageOptimizationUpload';
import Button from '../ui/Button';

interface BatchImageUploadProps {
  onImagesOptimized: (images: OptimizedImage[]) => void;
  onCancel: () => void;
}

export default function BatchImageUpload({ onImagesOptimized, onCancel }: BatchImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validation = validateImageFiles(fileArray);

    if (!validation.valid) {
      setError(validation.errors.join('\n'));
      return;
    }

    try {
      // Copy bytes into memory at selection time so optimize (which can happen much
      // later) can't hit net::ERR_UPLOAD_FILE_CHANGED on mobile temp files going stale.
      const snapshots = await Promise.all(fileArray.map(snapshotFileToMemory));
      setError(null);
      setSelectedFiles(prev => [...prev, ...snapshots]);
    } catch (err) {
      console.error('Error reading selected images:', err);
      setError('Could not read one or more selected images. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleOptimize = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setOptimizing(true);
      setError(null);
      setProgress({ current: 0, total: selectedFiles.length });

      const optimizedImages = await optimizeImages(
        selectedFiles,
        {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.85,
          convertToWebP: true,
        },
        (current, total) => {
          setProgress({ current, total });
        }
      );

      onImagesOptimized(optimizedImages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize images');
      setOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Upload Images</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
            disabled={optimizing}
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">Upload Error</p>
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {selectedFiles.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-700 mb-2">
                Drag and drop images here
              </p>
              <p className="text-sm text-slate-500 mb-4">or</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="primary"
              >
                Select Files
              </Button>
              <input name="file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <p className="text-xs text-slate-400 mt-4">
                Supported formats: JPEG, PNG, WebP (max 10MB each)
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} selected
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  disabled={optimizing}
                >
                  Add More
                </Button>
                <input name="file"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                      <button
                        onClick={() => removeFile(index)}
                        className="opacity-0 group-hover:opacity-100 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-all"
                        disabled={optimizing}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {optimizing && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-sm font-medium text-blue-900">
                  Optimizing images... {progress.current} of {progress.total}
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={optimizing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleOptimize}
            variant="primary"
            disabled={selectedFiles.length === 0 || optimizing}
          >
            {optimizing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Optimizing...
              </>
            ) : (
              <>
                <CheckCircle size={18} className="mr-2" />
                Optimize & Continue
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
