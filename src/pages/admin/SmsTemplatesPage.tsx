import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, RefreshCw, RotateCcw, Send } from 'lucide-react';
import {
  MAX_BODY_LENGTH,
  TEMPLATE_DEFAULTS,
  type TemplateDefault,
  type TemplateVariable,
  countSegments,
  renderPreview,
  validateTemplate,
} from '../../constants/smsTemplates';
import {
  type SavedSmsTemplate,
  type TemplatesResponse,
  refreshSmsTemplates,
  submitSmsTemplate,
} from '../../services/smsTemplateService';

type Draft = { body: string; variables: TemplateVariable[] };

const initialDrafts = (): Record<string, Draft> =>
  Object.fromEntries(TEMPLATE_DEFAULTS.map((t) => [t.key, { body: t.body, variables: t.variables.map((v) => ({ ...v })) }]));

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }) : '—';

const statusStyle = (status: string | null) => {
  const s = (status ?? '').toUpperCase();
  if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-800';
  if (s === 'REJECTED' || s === 'PAUSED') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

export default function SmsTemplatesPage() {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [saved, setSaved] = useState<SavedSmsTemplate[]>([]);
  const [keyMode, setKeyMode] = useState<TemplatesResponse['keyMode'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apply = (response: TemplatesResponse) => {
    setSaved(response.templates);
    setKeyMode(response.keyMode);
  };

  const refresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await refreshSmsTemplates();
      apply(response);
      if (response.refreshError) setMessage({ type: 'error', text: response.refreshError });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load templates.' });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await refreshSmsTemplates();
        if (cancelled) return;
        apply(response);
        if (response.refreshError) setMessage({ type: 'error', text: response.refreshError });
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load templates.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setBody = (key: string, body: string) => setDrafts((d) => ({ ...d, [key]: { ...d[key], body } }));
  const setSample = (key: string, id: number, sample: string) =>
    setDrafts((d) => ({
      ...d,
      [key]: { ...d[key], variables: d[key].variables.map((v) => (v.id === id ? { ...v, sample } : v)) },
    }));
  const reset = (template: TemplateDefault) => {
    setDrafts((d) => ({ ...d, [template.key]: { body: template.body, variables: template.variables.map((v) => ({ ...v })) } }));
    setConfirming(null);
  };

  const submit = async (template: TemplateDefault) => {
    const draft = drafts[template.key];
    setSubmitting(template.key);
    setMessage(null);
    try {
      const response = await submitSmsTemplate({
        name: template.label,
        secret_name: template.secret,
        category: template.category,
        body: draft.body,
        variables: draft.variables,
      });
      apply(response);
      setConfirming(null);
      setMessage({
        type: 'success',
        text: `${template.label} was submitted to Sent for review (ID ${response.sent_template_id}). Once it shows Approved, set ${template.secret} to that ID in Supabase.${
          response.recorded === false ? ' It could not be saved to the list below, so copy the ID now.' : ''
        }`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not submit the template.' });
    } finally {
      setSubmitting(null);
    }
  };

  const copy = (value: string) => navigator.clipboard?.writeText(value).catch(() => undefined);

  return (
    <div className="max-w-4xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">SMS Templates</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Review, edit and submit your customer text templates to Sent. Submit them once your 10DLC campaign is approved.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
        </div>
      )}

      {keyMode && keyMode !== 'live' && (
        <div className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            {keyMode === 'missing'
              ? 'The Sent API key is not set in Supabase, so nothing can be submitted yet.'
              : keyMode === 'test'
                ? 'The Sent API key is still a test key (sk_test_). Templates made with it are not real. Switch it to your live key once the campaign is approved.'
                : 'The Sent API key does not start with sk_live_ or sk_test_. Check the secret in Supabase.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {TEMPLATE_DEFAULTS.map((template) => {
          const draft = drafts[template.key];
          const problems = validateTemplate(draft.body, draft.variables);
          const estimate = countSegments(renderPreview(draft.body, draft.variables));
          const alreadySubmitted = saved.some((s) => s.secret_name === template.secret);
          const edited =
            draft.body !== template.body ||
            draft.variables.some((v, i) => v.sample !== template.variables[i].sample);

          return (
            <section key={template.key} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{template.label}</h2>
                  <p className="text-sm text-slate-600">{template.description}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {template.category === 'UTILITY' ? 'Service (utility)' : 'Promotional (marketing)'}
                </span>
              </div>

              {!template.wiredToSender && (
                <p className="mb-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  Nothing in the site sends this one yet. Submitting it only gets the wording approved.
                </p>
              )}

              <label htmlFor={`body-${template.key}`} className="block text-sm font-medium text-slate-700 mb-1">
                Message
              </label>
              <textarea
                id={`body-${template.key}`}
                value={draft.body}
                onChange={(e) => setBody(template.key, e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>
                  Keep the <code>{'{{0:variable}}'}</code> markers; they are filled in per customer.
                </span>
                <span>
                  {draft.body.trim().length}/{MAX_BODY_LENGTH}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Variables</p>
                <div className="space-y-2">
                  {draft.variables.map((v) => (
                    <div key={v.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[10rem_1fr] gap-2 items-center">
                      <code className="text-xs bg-slate-100 rounded px-2 py-1.5 text-slate-700">
                        {`{{${v.id}:variable}}`} {v.name}
                      </code>
                      <input
                        type="text"
                        value={v.sample}
                        onChange={(e) => setSample(template.key, v.id, e.target.value)}
                        aria-label={`Sample value for ${v.name}`}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Preview</p>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{renderPreview(draft.body, draft.variables)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {estimate.length} characters with these samples, about {estimate.segments} text segment
                  {estimate.segments === 1 ? '' : 's'} per customer
                  {estimate.unicode ? ' (special characters make each segment shorter)' : ''}. Real names, addresses and links vary,
                  so edit the samples to test a long one.
                </p>
              </div>

              {problems.length > 0 && (
                <ul className="mt-3 text-sm text-red-700 list-disc pl-5 space-y-0.5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}

              {alreadySubmitted && (
                <p className="mt-3 text-sm text-amber-800">
                  A {template.label.toLowerCase()} template was already submitted (see below). Submitting again creates a second one in Sent.
                </p>
              )}

              {confirming === template.key ? (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900 mb-3">
                    This sends the message above to Sent for carrier review. Make sure your 10DLC campaign shows as approved first. Submit now?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => submit(template)}
                      disabled={submitting !== null}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {submitting === template.key ? 'Submitting…' : 'Yes, submit to Sent'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      disabled={submitting !== null}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(template.key)}
                    disabled={problems.length > 0 || submitting !== null || keyMode === 'missing'}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Submit to Sent
                  </button>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => reset(template)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset to default
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-slate-900">Submitted templates</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : saved.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((t) => (
              <li key={t.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle(t.sent_status)}`}>
                    {t.sent_status ?? 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{t.body}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Submitted {formatWhen(t.created_at)} · status checked {formatWhen(t.status_checked_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <code className="bg-slate-100 rounded px-2 py-1 text-slate-700">
                    {t.secret_name ?? 'SENT_TEMPLATE_…'}={t.sent_template_id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(`${t.secret_name ?? 'SENT_TEMPLATE_…'}=${t.sent_template_id}`)}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500 mt-3">
          After a template shows Approved, add its line as a secret under Supabase → Edge Functions → Secrets. A text type
          with no template ID set is simply skipped, so you can turn them on one at a time.
        </p>
      </section>
    </div>
  );
}
