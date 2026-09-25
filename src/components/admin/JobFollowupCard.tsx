import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  RefreshCw,
  Send,
  TestTube2,
} from 'lucide-react';
import {
  describeFollowupStatus,
  getJobFollowupPreview,
  sendJobFollowupNow,
  sendJobFollowupTest,
  type JobFollowupPreview,
} from '../../services/jobFollowupService';

interface JobFollowupCardProps {
  jobId: string;
  /** Shown in the send confirmation so nobody mails the wrong client. */
  clientName: string;
}

/**
 * The post-job thank-you — a Google review ask and referral code — as it
 * will arrive, with the one line that says whether it is going out.
 *
 * Fires automatically once the job's scheduled end time passes. The body is
 * rendered by the edge function that sends it, so what shows here is the
 * email itself rather than a second template maintained in the browser.
 * Nothing here is editable on purpose: when the end time is wrong, the job
 * is wrong — fix the job and the follow-up follows.
 *
 * Mounted only inside an open client profile, so a page of collapsed rows
 * costs nothing — each mount is an edge function call.
 */
export default function JobFollowupCard({ jobId, clientName }: JobFollowupCardProps) {
  const [preview, setPreview] = useState<JobFollowupPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<'send' | 'test' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getJobFollowupPreview(jobId)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the follow-up');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // A card that collapses mid-flight must not write into an unmounted card.
    return () => {
      cancelled = true;
    };
  }, [jobId, attempt]);

  const runSend = useCallback(
    async (mode: 'send' | 'test') => {
      if (mode === 'send') {
        const to = preview?.recipient ?? clientName;
        const warning = preview?.status === 'sent'
          ? `${clientName} has already been followed up on. Send this email again to ${to}?`
          : `Send this follow-up to ${to} now, ahead of its scheduled time?`;
        if (!confirm(warning)) return;
      }

      setBusy(mode);
      setNotice(null);
      setError(null);
      try {
        const result = mode === 'send'
          ? await sendJobFollowupNow(jobId)
          : await sendJobFollowupTest(jobId);
        setNotice(
          mode === 'send'
            ? `Sent to ${result.to ?? 'the client'}.`
            : `Test copy sent to ${result.to ?? 'you'} — the client was not emailed.`,
        );
        // A real send moves the job's markers, so the status line is now stale.
        if (mode === 'send') setAttempt((value) => value + 1);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'The send failed');
      } finally {
        setBusy(null);
      }
    },
    [jobId, clientName, preview?.recipient, preview?.status],
  );

  // A job with no date has no follow-up to describe, and the job card
  // already says it is unscheduled.
  if (!loading && !error && preview?.reason === 'no_scheduled_date') return null;

  const statusTone = preview?.status === 'blocked'
    ? 'text-amber-900'
    : preview?.status === 'sent'
      ? 'text-slate-600'
      : 'text-slate-900';

  const StatusIcon = preview?.status === 'blocked'
    ? AlertCircle
    : preview?.status === 'sent'
      ? CheckCircle2
      : Clock;

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
        <Mail className="w-3 h-3" />
        Post-Job Follow-Up Email
      </p>

      {loading && (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-56 bg-slate-200 rounded" />
          <div className="h-3 w-40 bg-slate-200 rounded" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-900 break-words">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && preview && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${statusTone}`}>
              <StatusIcon
                className={`w-3.5 h-3.5 ${preview.status === 'blocked' ? 'text-amber-600' : 'text-emerald-600'}`}
              />
              {describeFollowupStatus(preview)}
            </span>
            {preview.recipient && (
              <span className="text-sm text-slate-500 break-all">to {preview.recipient}</span>
            )}
          </div>

          {/* Every other blocked reason is something the job itself fixes, so
              the card says so — except a cancellation, which the job can't
              fix, only resuming it can. */}
          {preview.status === 'blocked' && preview.reason !== 'cancelled' && (
            <p className="mt-1.5 text-xs text-amber-800">
              Fix this on the job and the follow-up picks it up automatically.
            </p>
          )}

          {notice && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
              {notice}
            </p>
          )}

          {preview.html && (
            <>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? 'Hide preview' : 'Preview email'}
                </button>

                <button
                  type="button"
                  onClick={() => runSend('test')}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TestTube2 className="w-3.5 h-3.5" />
                  {busy === 'test' ? 'Sending…' : 'Send test to me'}
                </button>

                {/* Only offered when the email could actually go out. A
                    blocked job would refuse server-side anyway; not showing
                    the button is the honest version of that. */}
                {preview.status !== 'blocked' && preview.recipient && (
                  <button
                    type="button"
                    onClick={() => runSend('send')}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {busy === 'send'
                      ? 'Sending…'
                      : preview.status === 'sent'
                        ? 'Send again'
                        : 'Send it now'}
                  </button>
                )}
              </div>

              {expanded && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-700">Subject:</span> {preview.subject}
                  </p>
                  {/* Sandboxed with no allow-* flags: this is our own markup,
                      but an email body is never worth granting scripts or
                      same-origin. */}
                  <iframe
                    title="Post-job follow-up email preview"
                    srcDoc={preview.html}
                    sandbox=""
                    className="w-full h-[32rem] rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
