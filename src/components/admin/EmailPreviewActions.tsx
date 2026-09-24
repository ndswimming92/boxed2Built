import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TestTube2,
} from 'lucide-react';
import type { ClientEmailPreview, TestSendResult } from '../../services/clientEmailService';

interface EmailPreviewActionsProps {
  /** Names the iframe for screen readers, e.g. 'Quote email'. */
  label: string;
  /**
   * Identifies what is being previewed. A change invalidates the preview: a
   * quote already on screen belongs to the job it was fetched for, and showing
   * it beside a different selection would be a lie with a screenshot attached.
   */
  previewKey: string;
  loadPreview: () => Promise<ClientEmailPreview>;
  sendTest: () => Promise<TestSendResult>;
  /** Nothing to preview yet — no job selected, no invoice made. */
  disabled?: boolean;
}

/**
 * "Preview email" and "Send test to me", for the emails an admin sends by hand
 * from a client's profile.
 *
 * The body comes from the edge function that sends it, so what shows here is
 * the email itself rather than a second template maintained in the browser.
 * Nothing is editable on purpose: when a price or a name reads wrong, the
 * record is wrong — fix the job or the invoice and the preview follows.
 *
 * Unlike the appointment reminder's card, which leads with a status line it
 * needs on mount, this fetches only when the preview is opened. A client
 * profile mounts three of these and most visits open none of them.
 */
export default function EmailPreviewActions({
  label,
  previewKey,
  loadPreview,
  sendTest,
  disabled = false,
}: EmailPreviewActionsProps) {
  const [preview, setPreview] = useState<ClientEmailPreview | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Bumped whenever a result in flight stops being the one worth showing — a
   * new fetch, a changed selection, an unmount. A preview that lands after the
   * admin has moved on is dropped rather than rendered under the wrong job.
   */
  const generation = useRef(0);
  const shownKey = useRef(previewKey);

  const fetchPreview = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadPreview();
      if (generation.current === mine) setPreview(result);
    } catch (err: unknown) {
      if (generation.current === mine) {
        setError(err instanceof Error ? err.message : 'Could not load the preview.');
      }
    } finally {
      if (generation.current === mine) setLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => {
    if (shownKey.current === previewKey) return;
    shownKey.current = previewKey;

    generation.current += 1;
    setPreview(null);
    setError(null);
    setNotice(null);
    setLoading(false);

    if (disabled) {
      setExpanded(false);
      return;
    }
    // An open preview follows the selection rather than closing under it.
    if (expanded) void fetchPreview();
  }, [previewKey, disabled, expanded, fetchPreview]);

  // Nothing in flight is worth writing into a card that is gone.
  useEffect(() => () => { generation.current += 1; }, []);

  const toggle = useCallback(() => {
    setNotice(null);
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!preview && !loading) void fetchPreview();
  }, [expanded, preview, loading, fetchPreview]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setNotice(null);
    setError(null);
    try {
      const result = await sendTest();
      setNotice(`Test copy sent to ${result.to ?? 'you'} — the client was not emailed.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The test send failed.');
    } finally {
      setTesting(false);
    }
  }, [sendTest]);

  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide preview' : 'Preview email'}
        </button>

        <button
          type="button"
          onClick={runTest}
          disabled={disabled || testing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <TestTube2 className="w-3.5 h-3.5" />
          {testing ? 'Sending...' : 'Send test to me'}
        </button>
      </div>

      {notice && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-green-800">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          {notice}
        </p>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-900 break-words">{error}</p>
            {expanded && !preview && !loading && (
              <button
                type="button"
                onClick={() => void fetchPreview()}
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
              >
                <RefreshCw className="w-3 h-3" />
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {expanded && loading && (
        <div className="mt-3 animate-pulse space-y-2">
          <div className="h-3 w-56 bg-gray-200 rounded" />
          <div className="h-64 w-full bg-gray-100 rounded-lg" />
        </div>
      )}

      {expanded && preview && !loading && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1.5 break-words">
            <span className="font-semibold text-gray-700">Subject:</span> {preview.subject}
          </p>
          <p className="text-xs text-gray-500 mb-1.5 break-all">
            <span className="font-semibold text-gray-700">To:</span>{' '}
            {preview.recipient ?? 'no address on file'}
          </p>

          {/* What would stop it going out, said here rather than discovered by
              pressing Send and reading an error. */}
          {preview.blocked && (
            <p className="mb-2 flex items-start gap-1.5 px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              {preview.blocked}
            </p>
          )}

          {/* Sandboxed with no allow-* flags: this is our own markup, but an
              email body is never worth granting scripts or same-origin. */}
          <iframe
            title={`${label} preview`}
            srcDoc={preview.html}
            sandbox=""
            className="w-full h-[32rem] rounded-lg border border-gray-200 bg-white"
          />
        </div>
      )}
    </div>
  );
}
