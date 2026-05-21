import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { Job } from '../../lib/supabase';
import { jobStatusService } from '../../services/jobStatusService';
import { useAuth } from '../../contexts/AuthContext';

interface CancelJobModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelJobModal({ job, isOpen, onClose, onSuccess }: CancelJobModalProps) {
  const { user } = useAuth();
  const [cancellationNotes, setCancellationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await jobStatusService.markJobAsCancelled({
        jobId: job.id,
        cancellationNotes: cancellationNotes.trim() || undefined,
        userId: user?.email,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to cancel job');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error cancelling job:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCancellationNotes('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/75 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-dvh sm:max-h-[90vh]">
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Cancel Job</h3>
              <p className="mt-1 text-sm text-gray-600">
                This will mark the job as cancelled
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 transition-colors rounded-lg hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-red-900">Job Details</h4>
                    <div className="mt-2 space-y-1 text-sm text-red-800">
                      <p><span className="font-medium">Client:</span> {job.client_name}</p>
                      {job.job_type && <p><span className="font-medium">Job Type:</span> {job.job_type}</p>}
                      {job.quoted_price && (
                        <p><span className="font-medium">Quoted Price:</span> ${job.quoted_price.toLocaleString()}</p>
                      )}
                      {job.date_scheduled && (
                        <p><span className="font-medium">Scheduled Date:</span> {new Date(job.date_scheduled).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="cancellationNotes" className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  id="cancellationNotes"
                  value={cancellationNotes}
                  onChange={(e) => setCancellationNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="Explain why this job was cancelled..."
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Document the reason for cancellation for your records
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Note:</span> Cancelled jobs remain in your system for record-keeping
                  but are removed from your active pipeline. You can view cancelled jobs by enabling the
                  "Show Lost & Cancelled Jobs" filter.
                </p>
              </div>
            </div>

            </div>
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Job
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Cancelling...' : 'Cancel Job'}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
