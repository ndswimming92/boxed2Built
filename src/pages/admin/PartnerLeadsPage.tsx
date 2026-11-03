import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Globe,
  Handshake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Send,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPartnerLeadEmails,
  getPartnerLeads,
  previewOutreach,
  sendOutreach,
  sendOutreachTest,
  updatePartnerLead,
} from '../../services/partnerLeadService';
import {
  PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABELS,
  PARTNER_STATUS_LABELS,
  STATUS_TABS,
  canEmail,
  foundLabel,
  isPlainEmail,
  matchesLeadSearch,
  partnerLinks,
  sortLeads,
} from '../../utils/partnerLeads';
import { mailtoHref, telHref, websiteLabel } from '../../utils/competitors';
import { toPoints } from '../../utils/grants';
import { centralToday, formatEndsOn, safeExternalUrl } from '../../utils/news';
import type {
  OutreachPreview,
  PartnerCategory,
  PartnerLead,
  PartnerLeadEdit,
  PartnerLeadEmail,
  PartnerStatus,
} from '../../types/partnerLeads';

interface Loaded {
  organizationId: string;
  leads: PartnerLead[];
  emails: PartnerLeadEmail[];
  error: string | null;
}

type CategoryFilter = PartnerCategory | 'all';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50';
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Saved text as a short list, one point per line. Plain text: it comes from web pages. */
function Points({ text }: { text: string | null }) {
  const points = toPoints(text);
  if (points.length === 0) return null;
  if (points.length === 1) return <p className="text-sm leading-relaxed break-words text-slate-700">{points[0]}</p>;
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed marker:text-slate-400 text-slate-700">
      {points.map((point, index) => (
        <li key={index} className="break-words pl-0.5">
          {point}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0 md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
      <h4 className="text-sm font-semibold text-slate-900 mb-2 md:mb-0">{title}</h4>
      <div className="max-w-prose">{children}</div>
    </section>
  );
}

function Contact({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: ElementType;
  label: string;
  value: string | null;
  href?: string | null;
  external?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm break-words">
        {!value ? (
          <span className="text-slate-400">Not found</span>
        ) : href ? (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-blue-700 hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="text-slate-800">{value}</span>
        )}
      </dd>
    </div>
  );
}

const STATUS_STYLES: Record<PartnerStatus, string> = {
  new: 'bg-emerald-100 text-emerald-800',
  contacted: 'bg-blue-100 text-blue-800',
  talking: 'bg-amber-100 text-amber-800',
  partner: 'bg-violet-100 text-violet-800',
  not_a_fit: 'bg-slate-200 text-slate-700',
  do_not_contact: 'bg-red-100 text-red-800',
};

/**
 * The review step. Shows the email exactly as the server would send it — the
 * server renders it, not the browser — and sends only from here.
 */
function ReviewDialog({
  lead,
  subject,
  body,
  onClose,
  onSent,
}: {
  lead: PartnerLead;
  subject: string;
  body: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [preview, setPreview] = useState<OutreachPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [sendAgain, setSendAgain] = useState(false);
  const [busy, setBusy] = useState<'send' | 'test' | null>(null);
  const [testSentTo, setTestSentTo] = useState<string | null>(null);
  // One id for this review step, shared by its send, its test and any retry.
  const [attemptId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    previewOutreach(lead.id, subject, body)
      .then((result) => !cancelled && setPreview(result))
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : 'Could not build the preview'));
    return () => {
      cancelled = true;
    };
  }, [lead.id, subject, body]);

  const send = async () => {
    if (!preview?.to) return;
    setBusy('send');
    setError(null);
    try {
      await sendOutreach(lead.id, subject, body, preview.to, attemptId, sendAgain);
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The email was not sent');
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setError(null);
    try {
      const result = await sendOutreachTest(lead.id, subject, body, attemptId);
      setTestSentTo(result.to);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The test was not sent');
    } finally {
      setBusy(null);
    }
  };

  const blockedReason = !preview
    ? null
    : preview.blocked
      ? 'This lead is marked Not a fit or Do not contact, so it cannot be emailed.'
      : !preview.to
        ? 'This lead has no usable email address. Add one under Edit contact first.'
        : null;
  const canSend = Boolean(preview && !blockedReason && checked && (!preview.recentlyEmailed || sendAgain));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`review-${lead.id}`}
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <h3 id={`review-${lead.id}`} className="text-lg font-bold text-slate-900">
            Review before sending
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!preview && !error && <p className="text-sm text-slate-600">Building the preview…</p>}

          {preview && (
            <>
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt className="font-semibold text-slate-500">To</dt>
                <dd className="break-all text-slate-900 font-semibold">{preview.to ?? 'No address'}</dd>
                <dt className="font-semibold text-slate-500">From</dt>
                <dd className="break-all text-slate-800">{preview.from}</dd>
                <dt className="font-semibold text-slate-500">Replies to</dt>
                <dd className="break-all text-slate-800">{preview.replyTo}</dd>
                <dt className="font-semibold text-slate-500">Subject</dt>
                <dd className="break-words text-slate-800">{preview.subject}</dd>
              </dl>

              {/* The server's own HTML, in a sandbox with scripts off. */}
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview.html}
                className="w-full h-80 rounded-lg border border-slate-200 bg-white"
              />

              {!preview.postalAddressSet && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  The footer shows “Spring Hill, TN” because no mailing address is set for outreach emails. Business
                  email rules call for a full mailing address (a P.O. box works).
                </p>
              )}

              {preview.recentlyEmailed && preview.lastEmailedAt && (
                <label className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={sendAgain}
                    onChange={(event) => setSendAgain(event.target.checked)}
                  />
                  <span>
                    You emailed them on {formatInstant(preview.lastEmailedAt)}. Tick to send another email anyway.
                  </span>
                </label>
              )}

              {blockedReason ? (
                <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">{blockedReason}</p>
              ) : (
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  <span>I have checked the address and the message, and this is ready to send.</span>
                </label>
              )}
            </>
          )}

          {testSentTo && (
            <p className="text-sm text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Test sent to {testSentTo}.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={busy !== null}>
            Back to editing
          </button>
          <button type="button" onClick={sendTest} className={secondaryButton} disabled={!preview || busy !== null}>
            {busy === 'test' ? 'Sending test…' : 'Send me a test'}
          </button>
          <button type="button" onClick={send} className={primaryButton} disabled={!canSend || busy !== null}>
            <Send className="w-4 h-4" aria-hidden="true" />
            {busy === 'send' ? 'Sending…' : preview?.to ? `Send to ${preview.to}` : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  emails,
  today,
  saving,
  onSave,
  onSent,
}: {
  lead: PartnerLead;
  emails: PartnerLeadEmail[];
  today: string;
  saving: boolean;
  onSave: (lead: PartnerLead, changes: PartnerLeadEdit) => Promise<boolean>;
  onSent: (lead: PartnerLead) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(lead.draft_subject ?? '');
  const [body, setBody] = useState(lead.draft_body ?? '');
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [editingContact, setEditingContact] = useState(false);
  const [contact, setContact] = useState({
    email: lead.email ?? '',
    contact_name: lead.contact_name ?? '',
    contact_title: lead.contact_title ?? '',
  });
  const [reviewing, setReviewing] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

  // Pick up a draft the server saved (a send stores what went out), the
  // render-time way React recommends for following a prop.
  const [syncedDraft, setSyncedDraft] = useState({ subject: lead.draft_subject, body: lead.draft_body });
  if (syncedDraft.subject !== lead.draft_subject || syncedDraft.body !== lead.draft_body) {
    setSyncedDraft({ subject: lead.draft_subject, body: lead.draft_body });
    setSubject(lead.draft_subject ?? '');
    setBody(lead.draft_body ?? '');
  }

  const website = safeExternalUrl(lead.website_url);
  const emailSource = safeExternalUrl(lead.email_source_url);
  const links = partnerLinks(lead.links);
  const draftChanged = subject !== (lead.draft_subject ?? '') || body !== (lead.draft_body ?? '');
  const notesChanged = notes !== (lead.notes ?? '');
  const emailable = canEmail(lead.status);
  const contactEmailValid = contact.email.trim() === '' || isPlainEmail(contact.email);

  const saveContact = async () => {
    const ok = await onSave(lead, {
      email: contact.email.trim() || null,
      contact_name: contact.contact_name.trim() || null,
      contact_title: contact.contact_title.trim() || null,
    });
    if (ok) setEditingContact(false);
  };

  return (
    <article className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-labelledby={`lead-${lead.id}`}>
      <div onClick={() => setExpanded((open) => !open)} className="cursor-pointer px-5 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded">
            {PARTNER_CATEGORY_LABELS[lead.category] ?? lead.category}
          </span>
          <span className={`px-2 py-1 font-semibold rounded ${STATUS_STYLES[lead.status]}`}>
            {PARTNER_STATUS_LABELS[lead.status]}
          </span>
          {!isPlainEmail(lead.email) && (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 font-semibold rounded">No email found</span>
          )}
          <span className="text-slate-500">{foundLabel(lead.found_on, today)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 id={`lead-${lead.id}`} className="text-lg font-bold text-slate-900 break-words">
            <button
              type="button"
              aria-expanded={expanded}
              className="text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {lead.name}
            </button>
          </h3>
          <ChevronDown
            className={`w-5 h-5 mt-1 flex-shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          {lead.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
              {lead.location}
            </span>
          )}
          {lead.contact_name && (
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" aria-hidden="true" />
              {lead.contact_name}
              {lead.contact_title ? `, ${lead.contact_title}` : ''}
            </span>
          )}
        </p>
        <p className={`mt-2 max-w-prose text-sm leading-relaxed text-slate-700 break-words ${expanded ? '' : 'line-clamp-2'}`}>
          {lead.summary}
        </p>
      </div>

      {expanded && (
        <div className="border-t border-slate-200">
          {editingContact ? (
            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">
                Email
                <input
                  type="email"
                  className={`${inputClass} mt-1`}
                  value={contact.email}
                  onChange={(event) => setContact({ ...contact, email: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Person to ask for
                <input
                  className={`${inputClass} mt-1`}
                  value={contact.contact_name}
                  onChange={(event) => setContact({ ...contact, contact_name: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Their role
                <input
                  className={`${inputClass} mt-1`}
                  value={contact.contact_title}
                  onChange={(event) => setContact({ ...contact, contact_title: event.target.value })}
                />
              </label>
              {!contactEmailValid && (
                <p className="sm:col-span-3 text-xs text-red-700">Enter one plain email address.</p>
              )}
              <div className="sm:col-span-3 flex gap-2">
                <button type="button" className={primaryButton} disabled={saving || !contactEmailValid} onClick={saveContact}>
                  Save contact
                </button>
                <button type="button" className={secondaryButton} onClick={() => setEditingContact(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200">
              <Contact
                icon={User}
                label="Ask for"
                value={lead.contact_name ? `${lead.contact_name}${lead.contact_title ? `, ${lead.contact_title}` : ''}` : null}
              />
              <Contact icon={Mail} label="Email" value={lead.email} href={mailtoHref(lead.email)} />
              <Contact icon={Phone} label="Phone" value={lead.phone} href={telHref(lead.phone)} />
              <Contact icon={Globe} label="Website" value={website ? websiteLabel(website) : null} href={website} external />
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {emailSource && (
                  <a href={emailSource} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    Where the email was found <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setEditingContact(true)}
                  className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" /> Edit contact
                </button>
              </div>
            </dl>
          )}

          <div className="px-5 sm:px-6 py-4 divide-y divide-slate-100">
            <Section title="Why they're a fit">
              <Points text={lead.why_fit} />
            </Section>
            {lead.partnership_idea && (
              <Section title="Partnership idea">
                <Points text={lead.partnership_idea} />
              </Section>
            )}
            {links.length > 0 && (
              <Section title="Find them online">
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                        {link.label} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Outreach email">
              {emailable ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Subject
                    <input
                      className={`${inputClass} mt-1`}
                      value={subject}
                      maxLength={200}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Message
                    <textarea
                      className={`${inputClass} mt-1 min-h-[14rem] leading-relaxed`}
                      value={body}
                      maxLength={5000}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Your signature and a one-line opt-out are added below the message when it is sent.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={saving || !subject.trim() || !body.trim()}
                      onClick={() => {
                        setSentNotice(false);
                        setReviewing(true);
                      }}
                    >
                      <Send className="w-4 h-4" aria-hidden="true" /> Review &amp; send
                    </button>
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={saving || !draftChanged || !subject.trim() || !body.trim()}
                      onClick={() => onSave(lead, { draft_subject: subject.trim(), draft_body: body.trim() })}
                    >
                      Save draft
                    </button>
                  </div>
                  {sentNotice && (
                    <p className="text-sm text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Sent.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Marked {PARTNER_STATUS_LABELS[lead.status]}, so it cannot be emailed. Change the status to email them.
                </p>
              )}
            </Section>

            {emails.length > 0 && (
              <Section title="Sent">
                <ul className="space-y-3">
                  {emails.map((email) => (
                    <li key={email.id}>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-slate-800">
                          <span className="font-semibold">{email.subject}</span>
                          <span className="text-slate-500"> · {formatInstant(email.sent_at)} · {email.to_email}</span>
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                          {email.body}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Status & notes">
              <div className="space-y-3">
                <select
                  aria-label="Status"
                  className={inputClass}
                  value={lead.status}
                  disabled={saving}
                  onChange={(event) => onSave(lead, { status: event.target.value as PartnerStatus })}
                >
                  {(Object.keys(PARTNER_STATUS_LABELS) as PartnerStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {PARTNER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label="Notes"
                  placeholder="Notes: who you spoke to, what they said, next step…"
                  className={`${inputClass} min-h-[5rem]`}
                  value={notes}
                  maxLength={4000}
                  onChange={(event) => setNotes(event.target.value)}
                />
                {notesChanged && (
                  <button type="button" className={secondaryButton} disabled={saving} onClick={() => onSave(lead, { notes: notes.trim() || null })}>
                    Save notes
                  </button>
                )}
              </div>
            </Section>
          </div>
        </div>
      )}

      {reviewing && (
        <ReviewDialog
          lead={lead}
          subject={subject}
          body={body}
          onClose={() => setReviewing(false)}
          onSent={() => {
            setReviewing(false);
            setSentNotice(true);
            onSent(lead);
          }}
        />
      )}
    </article>
  );
}

export function PartnerLeadsView({ organizationId }: { organizationId: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tab, setTab] = useState('new');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sentBanner, setSentBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    Promise.all([getPartnerLeads(organizationId), getPartnerLeadEmails(organizationId)])
      .then(([leads, emails]) => {
        if (!cancelled) setLoaded({ organizationId, leads, emails, error: null });
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoaded({
          organizationId,
          leads: [],
          emails: [],
          error: cause instanceof Error ? cause.message : 'Failed to load Partner Leads',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadKey]);

  const save = async (lead: PartnerLead, changes: PartnerLeadEdit): Promise<boolean> => {
    if (!organizationId || savingIds.has(lead.id)) return false;
    setSavingIds((pending) => new Set(pending).add(lead.id));
    setSaveError(null);
    try {
      const saved = await updatePartnerLead(lead.id, organizationId, changes);
      setLoaded((previous) =>
        previous && previous.organizationId === organizationId
          ? { ...previous, leads: previous.leads.map((row) => (row.id === saved.id ? saved : row)) }
          : previous,
      );
      return true;
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Failed to save');
      return false;
    } finally {
      setSavingIds((pending) => {
        const next = new Set(pending);
        next.delete(lead.id);
        return next;
      });
    }
  };

  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  const loading = organizationId !== null && current === null;
  const error = current?.error ?? null;
  const leads = useMemo(() => current?.leads ?? [], [current]);
  const emailsByLead = useMemo(() => {
    const map = new Map<string, PartnerLeadEmail[]>();
    for (const email of current?.emails ?? []) {
      const list = map.get(email.lead_id) ?? [];
      list.push(email);
      map.set(email.lead_id, list);
    }
    return map;
  }, [current]);

  const today = centralToday();
  const tabInfo = STATUS_TABS.find((candidate) => candidate.key === tab) ?? STATUS_TABS[0];

  const { tabCounts, categoryCounts, visible } = useMemo(() => {
    const matching = leads.filter((lead) => matchesLeadSearch(lead, search));
    const tabCounts: Record<string, number> = {};
    for (const candidate of STATUS_TABS) {
      tabCounts[candidate.key] = matching.filter((lead) => candidate.statuses.includes(lead.status)).length;
    }
    const inTab = matching.filter((lead) => tabInfo.statuses.includes(lead.status));
    const categoryCounts: Record<string, number> = { all: inTab.length };
    for (const lead of inTab) categoryCounts[lead.category] = (categoryCounts[lead.category] ?? 0) + 1;
    const shown = inTab.filter((lead) => category === 'all' || lead.category === category);
    return { tabCounts, categoryCounts, visible: sortLeads(shown, tabInfo.key) };
  }, [leads, search, tabInfo, category]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const lastFound = leads.reduce<string | null>((latest, lead) => (!latest || lead.found_on > latest ? lead.found_on : latest), null);
  const categoriesShown = PARTNER_CATEGORIES.filter((value) => (categoryCounts[value] ?? 0) > 0 || category === value);

  return (
    <div className="max-w-5xl px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Partner Leads</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Local businesses around Spring Hill that could send customers your way: movers, apartment and townhome
          communities, property managers, realtors, builders and more. New ones are added every morning, each with a
          draft email you can edit, review and send from here. Only the business’s owners and admins can see this page.
        </p>
        {lastFound && !error && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <CalendarClock className="w-4 h-4" aria-hidden="true" />
            Newest leads found {formatEndsOn(lastFound)}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm flex-1 text-red-800">{error}. Reload the page to try again.</p>
        </div>
      )}

      {!organizationId && (
        <div role="alert" className="mb-6 p-4 rounded-lg flex items-start gap-3 bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm flex-1 text-amber-900">
            No organization is selected, so there is nothing to show. Sign out and back in, then try again.
          </p>
        </div>
      )}

      {organizationId && !error && (
        <>
          {sentBanner && (
            <div role="status" className="mb-4 p-3 rounded-lg flex items-start gap-3 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm flex-1 text-emerald-900">{sentBanner}</p>
              <button type="button" onClick={() => setSentBanner(null)} aria-label="Dismiss" className="p-0.5">
                <X className="w-4 h-4 text-emerald-700" />
              </button>
            </div>
          )}
          {saveError && (
            <div role="alert" className="mb-4 p-3 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm flex-1 text-red-800">{saveError}</p>
            </div>
          )}

          <div className="mb-4 flex gap-1 sm:gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Leads by status">
            {STATUS_TABS.map((candidate) => {
              const isActive = candidate.key === tab;
              return (
                <button
                  key={candidate.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setTab(candidate.key);
                    setCategory('all');
                  }}
                  className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    isActive ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {candidate.label}
                  <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    {tabCounts[candidate.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search leads"
                placeholder="Search name, town, contact…"
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Filter by kind of business">
              {[{ value: 'all' as CategoryFilter, label: 'All' }, ...categoriesShown.map((value) => ({ value: value as CategoryFilter, label: PARTNER_CATEGORY_LABELS[value] }))].map(
                (chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    aria-pressed={category === chip.value}
                    onClick={() => setCategory(chip.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      category === chip.value
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label} <span className="opacity-75">{categoryCounts[chip.value] ?? 0}</span>
                  </button>
                ),
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-slate-600">{search.trim() ? 'No leads match your search.' : tabInfo.empty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  emails={emailsByLead.get(lead.id) ?? []}
                  today={today}
                  saving={savingIds.has(lead.id)}
                  onSave={save}
                  onSent={(sentLead) => {
                    setSentBanner(
                      sentLead.status === 'new'
                        ? `Email sent to ${sentLead.name}. It moved to the Contacted tab.`
                        : `Email sent to ${sentLead.name}.`,
                    );
                    setReloadKey((key) => key + 1);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PartnerLeadsPage() {
  const { currentOrganization } = useAuth();
  return <PartnerLeadsView organizationId={currentOrganization?.id ?? null} />;
}
