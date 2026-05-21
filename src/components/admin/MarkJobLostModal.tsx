import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Job, LostReasonCategory } from '../../lib/supabase';
import { jobStatusService, LOST_REASON_CATEGORIES } from '../../services/jobStatusService';
import { useAuth } from '../../contexts/AuthContext';

interface MarkJobLostModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MarkJobLostModal({ job, isOpen, onClose, onSuccess }: MarkJobLostModalProps) {
  const { user } = useAuth();
  const [lostReasonCategory, setLostReasonCategory] = useState<LostReasonCategory>('Price too high');
  const [lostReasonNotes, setLostReasonNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await jobStatusService.markJobAsLost({
        jobId: job.id,
        lostReasonCategory,
        lostReasonNotes: lostReasonNotes.trim() || undefined,
        userId: user?.email,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to mark job as lost');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error marking job as lost:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setLostReasonCategory('Price too high');
      setLostReasonNotes('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/75 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-dvh sm:max-h-[90vh]">
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Mark Job as Lost</h3>
              <p className="mt-1 text-sm text-gray-600">
                This will remove the job from your active pipeline
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
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-amber-900">Job Details</h4>
                    <div className="mt-2 space-y-1 text-sm text-amber-800">
                      <p><span className="font-medium">Client:</span> {job.client_name}</p>
                      {job.job_type && <p><span className="font-medium">Job Type:</span> {job.job_type}</p>}
                      {job.quoted_price && (
                        <p><span className="font-medium">Quoted Price:</span> ${job.quoted_price.toLocaleString()}</p>
                      )}
                      {job.date_quoted && (
                        <p><span className="font-medium">Date Quoted:</span> {new Date(job.date_quoted).toLocaleDateString()}</p>
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
                <label htmlFor="lostReasonCategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Lost Reason <span className="text-red-500">*</span>
                </label>
                <select
                  id="lostReasonCategory"
                  value={lostReasonCategory}
                  onChange={(e) => setLostReasonCategory(e.target.value as LostReasonCategory)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                >
                  {LOST_REASON_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the primary reason why this job was lost
                </p>
              </div>

              <div>
                <label htmlFor="lostReasonNotes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  id="lostReasonNotes"
                  value={lostReasonNotes}
                  onChange={(e) => setLostReasonNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="Add any additional details about why this job was lost..."
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Provide specific details to help identify patterns and improve your close rate
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Marking as Lost...' : 'Mark as Lost'}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
