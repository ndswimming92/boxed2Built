/**
 * The partnership outreach email: what Nicholas wrote (or the daily run drafted
 * and he edited), wrapped in a plain signature and the footer every commercial
 * email needs. Pure functions only, so the browser preview, the test send and
 * the real send are all the same text, and the unit tests can run them on node.
 */

export const OUTREACH_FROM_NAME = 'Nicholas Davidson';
export const OUTREACH_FROM_EMAIL = 'nicholas.davidson@boxed2built.com';
export const OUTREACH_PHONE = '(615) 403-4538';
export const OUTREACH_WEBSITE = 'https://boxed2built.com';

/** A lead emailed this recently needs an explicit "send again" to be emailed again. */
export const RESEND_GUARD_DAYS = 7;

export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;

/** Statuses the send function refuses outright. */
export const BLOCKED_STATUSES = ['not_a_fit', 'do_not_contact'] as const;

/** One plain address, nothing that could smuggle a second recipient or a header. */
export function isSendableAddress(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  if (email.length > 320) return false;
  return /^[^@\s,;<>"']+@[^@\s,;<>"']+\.[^@\s,;<>"']+$/.test(email);
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Line endings normalised, trailing spaces trimmed, no more than one blank line in a row. */
export function normalizeBody(body: string): string {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A subject is one line: newlines would be a header injection, so they become spaces. */
export function normalizeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export interface OutreachInput {
  subject: string;
  body: string;
  /** Where the footer says the business is. Set OUTREACH_POSTAL_ADDRESS on the function. */
  postalAddress: string | null;
}

export type OutreachProblem = 'subject_missing' | 'subject_too_long' | 'body_missing' | 'body_too_long';

export function checkOutreach(subject: string, body: string): OutreachProblem | null {
  const s = normalizeSubject(subject);
  const b = normalizeBody(body);
  if (!s) return 'subject_missing';
  if (s.length > SUBJECT_MAX) return 'subject_too_long';
  if (!b) return 'body_missing';
  if (b.length > BODY_MAX) return 'body_too_long';
  return null;
}

const SIGNATURE_LINES = [
  OUTREACH_FROM_NAME,
  'Owner, Boxed2Built',
  OUTREACH_PHONE,
  OUTREACH_FROM_EMAIL,
  'boxed2built.com',
];

const OPT_OUT_LINE =
  "Not the right fit? Just reply and let me know, and I won't email you again.";

function footerAddress(postalAddress: string | null): string {
  const address = postalAddress?.trim();
  return address ? `Boxed2Built LLC, ${address}` : 'Boxed2Built LLC, Spring Hill, TN';
}

export interface RenderedOutreach {
  subject: string;
  text: string;
  html: string;
}

export function renderOutreach({ subject, body, postalAddress }: OutreachInput): RenderedOutreach {
  const cleanSubject = normalizeSubject(subject);
  const cleanBody = normalizeBody(body);

  const text = [cleanBody, '', ...SIGNATURE_LINES, '', '--', OPT_OUT_LINE, footerAddress(postalAddress)].join('\n');

  const paragraphs = cleanBody
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`,
    )
    .join('\n');

  const signature = `<p style="margin:24px 0 0;color:#1f2937;font-size:15px;line-height:1.5;">
<strong>${escapeHtml(OUTREACH_FROM_NAME)}</strong><br>
Owner, Boxed2Built<br>
${escapeHtml(OUTREACH_PHONE)}<br>
<a href="mailto:${OUTREACH_FROM_EMAIL}" style="color:#1d4ed8;">${OUTREACH_FROM_EMAIL}</a><br>
<a href="${OUTREACH_WEBSITE}" style="color:#1d4ed8;">boxed2built.com</a></p>`;

  const footer = `<p style="margin:32px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6;">
${escapeHtml(OPT_OUT_LINE)}<br>${escapeHtml(footerAddress(postalAddress))}</p>`;

  // Deliberately plain: a one-to-one note between two local businesses, not a
  // newsletter. Fancy templates read as marketing and land in Promotions.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:600px;">
${paragraphs}
${signature}
${footer}
</div></body></html>`;

  return { subject: cleanSubject, text, html };
}

/** Days since an ISO instant, or null when there is none. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / 86_400_000;
}

/** A stable key so a double click, or a retry, sends one email rather than two. The caller folds an attempt id into `to` so a deliberate resend gets its own key. */
export async function idempotencyKey(leadId: string, to: string, subject: string, body: string): Promise<string> {
  const data = new TextEncoder().encode(`${leadId}\n${to.toLowerCase()}\n${subject}\n${body}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `partner-outreach/${leadId}/${hex.slice(0, 32)}`;
}
