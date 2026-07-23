import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Youtube } from 'lucide-react';
import { uploadVideoToYoutube, YoutubePrivacyStatus, YoutubeUploadResult } from '../../services/socialPublishService';

interface YoutubeUploadModalProps {
  onClose: () => void;
  onUploaded: (result: YoutubeUploadResult, title: string, description: string) => void;
}

const MAX_TITLE_LENGTH = 100;

export default function YoutubeUploadModal({ onClose, onUploaded }: YoutubeUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<YoutubePrivacyStatus>('private');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YoutubeUploadResult | null>(null);

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    if (selected && !title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, '').slice(0, MAX_TITLE_LENGTH));
    }
  };

  const handleUpload = async () => {
    setError(null);
    if (!file) {
      setError('Choose a video file first.');
      return;
    }
    if (!title.trim()) {
      setError('Give the video a title.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const uploadResult = await uploadVideoToYoutube(
        file,
        { title: title.trim(), description: description.trim(), privacyStatus },
        setProgress,
      );
      setResult(uploadResult);
      onUploaded(uploadResult, title.trim(), description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload to YouTube.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-600" />
            {result ? 'Uploaded to YouTube' : 'Upload to YouTube'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-6">
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">
                Your video is uploaded.{' '}
                <a href={result.videoUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Watch it on YouTube
                </a>
                {privacyStatus === 'private' && ' (currently Private — change visibility any time in YouTube Studio).'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="yt-file" className="block text-sm font-medium text-slate-700 mb-1.5">
                Video file
              </label>
              <input
                id="yt-file"
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-medium hover:file:bg-slate-200"
              />
              {file && (
                <p className="text-xs text-slate-500 mt-1">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            <div>
              <label htmlFor="yt-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                Title
              </label>
              <input
                id="yt-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                disabled={uploading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="yt-description" className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                id="yt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="yt-privacy" className="block text-sm font-medium text-slate-700 mb-1.5">
                Visibility
              </label>
              <select
                id="yt-privacy"
                value={privacyStatus}
                onChange={(e) => setPrivacyStatus(e.target.value as YoutubePrivacyStatus)}
                disabled={uploading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="private">Private — only you can see it</option>
                <option value="unlisted">Unlisted — anyone with the link</option>
                <option value="public">Public — visible on your channel</option>
              </select>
            </div>

            {uploading && (
              <div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-red-600 h-2 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">Uploading… {progress}%</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={uploading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
