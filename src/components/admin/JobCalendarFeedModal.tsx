import { useEffect, useState } from 'react';
import { X, Calendar, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  buildCalendarFeedUrl,
  buildCalendarSubscribeUrl,
  getOrCreateCalendarFeedToken,
  rotateCalendarFeedToken,
  type CalendarFeedToken,
} from '../../services/jobScheduleCalendarService';

interface JobCalendarFeedModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Hands the admin their subscribable job-calendar URL.
 *
 * The token in that URL is the only thing guarding the feed, so it is created
 * lazily on first open and can be rotated here if it ever leaks.
 */
export default function JobCalendarFeedModal({
  organizationId,
  isOpen,
  onClose,
}: JobCalendarFeedModalProps) {
  const [feedToken, setFeedToken] = useState<CalendarFeedToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getOrCreateCalendarFeedToken(organizationId)
      .then((token) => {
        if (cancelled) return;
        if (!token) {
          setError('Could not load the calendar feed link. Please try again.');
          return;
        }
        setFeedToken(token);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // The modal can close mid-request; do not write state into an unmounted view.
    return () => {
      cancelled = true;
    };
  }, [isOpen, organizationId]);

  if (!isOpen) return null;

  const feedUrl = feedToken ? buildCalendarFeedUrl(feedToken.token) : '';
  const subscribeUrl = feedToken ? buildCalendarSubscribeUrl(feedToken.token) : '';

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — select the link and copy it manually.');
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    setError(null);
    const rotated = await rotateCalendarFeedToken(organizationId);
    if (rotated) {
      setFeedToken(rotated);
      setConfirmingRotate(false);
    } else {
      setError('Could not rotate the link. Please try again.');
    }
    setRotating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calendar className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subscribe to your job calendar</h2>
              <p className="text-sm text-slate-600">Every scheduled job, kept in sync automatically.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <p className="text-sm text-slate-600">Loading your calendar link…</p>
          ) : (
            <>
              {feedToken && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Your private calendar link
                    </label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={feedUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                      />
                      <button
                        onClick={handleCopy}
                        className="px-3 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-sm flex-shrink-0"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <a
                    href={subscribeUrl}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Add to calendar app
                  </a>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                      Setting it up
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      <strong>Apple Calendar / iPhone:</strong> File → New Calendar Subscription, paste
                      the link, then set Auto-refresh to Every hour.
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      <strong>Google Calendar:</strong> Other calendars → From URL, paste the link.
                      Google refreshes on its own schedule and can lag up to a day — the per-job email
                      is what reaches you immediately.
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div className="space-y-3 min-w-0">
                        <p className="text-sm text-amber-900 leading-relaxed">
                          Anyone with this link can read your job schedule, including client names and
                          addresses. Treat it like a password. If it gets out, rotate it — subscribers
                          will need the new link.
                        </p>
                        {confirmingRotate ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={handleRotate}
                              disabled={rotating}
                              className="px-3 py-1.5 bg-amber-700 text-white rounded-lg font-medium hover:bg-amber-800 transition-colors text-sm disabled:opacity-60"
                            >
                              {rotating ? 'Rotating…' : 'Yes, rotate it'}
                            </button>
                            <button
                              onClick={() => setConfirmingRotate(false)}
                              disabled={rotating}
                              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingRotate(true)}
                            className="px-3 py-1.5 bg-white text-amber-900 border border-amber-300 rounded-lg font-medium hover:bg-amber-100 transition-colors flex items-center gap-1.5 text-sm"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Rotate link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
