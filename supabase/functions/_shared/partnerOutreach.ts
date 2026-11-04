/**
 * The partnership outreach email: what Nicholas wrote (or the daily run drafted
 * and he edited), in the Boxed2Built letterhead, ending with his own closing
 * and a small contact card, then the footer every commercial email needs.
 *
 * Pure functions only, with no Deno or DOM APIs beyond `crypto.subtle`, so the
 * page's live preview, the review step, the test send and the real send all
 * come from this one file, and the unit tests can run it on node. The admin
 * page imports it directly rather than keeping a twin copy, so what Nicholas
 * sees while typing cannot drift from what is sent.
 *
 * The message is stored and sent as plain text with a little markup that the
 * editor's toolbar writes:
 *
 *   **bold**   *italic*   __underline__   [words](https://link)
 *   - a bullet line        1. a numbered line
 *   [button: Book online](https://boxed2built.com/book)   (on a line of its own)
 *
 * Everything else is escaped, and only http(s), mailto: and tel: links are
 * turned into links, so a draft can never inject HTML or a script link.
 */

import { SOCIAL_LINKS, socialFooterHtml, socialFooterText } from './emailSocialFooter.ts';

export const OUTREACH_FROM_NAME = 'Nicholas Davidson';
export const OUTREACH_FROM_EMAIL = 'nicholas.davidson@boxed2built.com';
export const OUTREACH_PHONE = '(615) 403-4538';
export const OUTREACH_PHONE_HREF = 'tel:+16154034538';
export const OUTREACH_WEBSITE = 'https://boxed2built.com';

/** The sign-off every outreach email ends with, as Nicholas writes it. */
export const OUTREACH_CLOSING_LINES = ['Thanks for your time,', OUTREACH_FROM_NAME, 'Boxed2Built'] as const;

/** Pages the editor offers as one-click links and buttons. */
export const OUTREACH_QUICK_LINKS = [
  { label: 'Website', text: 'boxed2built.com', url: `${OUTREACH_WEBSITE}/` },
  { label: 'Book online', text: 'Book online', url: `${OUTREACH_WEBSITE}/book` },
  { label: 'Gift cards', text: 'Boxed2Built gift cards', url: `${OUTREACH_WEBSITE}/gift-cards` },
  { label: 'Partners', text: 'Partner with Boxed2Built', url: `${OUTREACH_WEBSITE}/partners` },
  { label: 'Services', text: 'Our services', url: `${OUTREACH_WEBSITE}/services` },
] as const;

/** A lead emailed this recently needs an explicit "send again" to be emailed again. */
export const RESEND_GUARD_DAYS = 7;

export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;

/** Statuses the send function refuses outright. */
export const BLOCKED_STATUSES = ['not_a_fit', 'do_not_contact'] as const;

// Brand colours, the same ones the customer and digest emails use.
const NAVY = '#1e3a5f';
const GOLD = '#D9A441';
const INK = '#1f2937';
const MUTED = '#64748b';
const LINK = '#1e3a8a';
const LINE = '#e5e7eb';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

/** One plain address, nothing that could smuggle a second recipient or a header. */
export function isSendableAddress(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  if (email.length > 320) return false;
  return /^[^@\s,;<>"']+@[^@\s,;<>"']+\.[^@\s,;<>"']+$/.test(email);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

/** Only web, mail and phone links. Anything else (javascript:, data:, relative) stays text. */
export function isSafeLinkUrl(url: string): boolean {
  const value = url.trim();
  if (/^mailto:[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/i.test(value)) return true;
  if (/^tel:\+?[0-9().\- ]{7,20}$/i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Makes sure the email ends with Nicholas's closing. A body that already signs
 * off with his name is left as written. A body whose last line is a short
 * sign-off ("Thanks for your time,", "Best,") gets his name and Boxed2Built
 * under it. Anything else gets the whole closing.
 */
export function withClosing(body: string): string {
  const clean = normalizeBody(body);
  if (!clean) return clean;
  const lines = clean.split('\n');
  const tail = lines.slice(-4).map((line) => line.trim().toLowerCase());
  if (tail.some((line) => line.replace(/[*_]/g, '') === OUTREACH_FROM_NAME.toLowerCase())) return clean;
  const last = lines[lines.length - 1].trim();
  const isSignOff = last.length <= 40 && /,$/.test(last) && !/[.!?]/.test(last);
  if (isSignOff) return `${clean}\n${OUTREACH_CLOSING_LINES.slice(1).join('\n')}`;
  return `${clean}\n\n${OUTREACH_CLOSING_LINES.join('\n')}`;
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

// ---------------------------------------------------------------------------
// Markup

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BUTTON_LINE = /^\[button:\s*([^\]\n]+?)\s*\]\(([^)\s]+)\)$/i;
const BULLET_LINE = /^[-*•]\s+(.+)$/;
const NUMBER_LINE = /^\d{1,3}[.)]\s+(.+)$/;

/** Bold, underline and italic on text that is already escaped. */
function emphasis(escaped: string): string {
  return escaped
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '<u>$1</u>')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>');
}

function linkHtml(label: string, url: string): string {
  return `<a href="${escapeHtml(url.trim())}" target="_blank" rel="noopener noreferrer" style="color:${LINK};font-weight:600;text-decoration:underline;">${emphasis(escapeHtml(label))}</a>`;
}

/** One line of typed text as HTML: escaped, links for safe URLs only, then emphasis. */
export function inlineHtml(line: string): string {
  let out = '';
  let last = 0;
  for (const match of line.matchAll(LINK_PATTERN)) {
    const [whole, label, url] = match;
    const at = match.index ?? 0;
    out += emphasis(escapeHtml(line.slice(last, at)));
    out += isSafeLinkUrl(url) ? linkHtml(label, url) : emphasis(escapeHtml(whole));
    last = at + whole.length;
  }
  return out + emphasis(escapeHtml(line.slice(last)));
}

/** The same line as plain text: markers dropped, links spelled out. */
export function inlineText(line: string): string {
  return line
    .replace(LINK_PATTERN, (whole, label: string, url: string) => {
      if (!isSafeLinkUrl(url)) return whole;
      const shown = url.replace(/^mailto:|^tel:/i, '');
      return label.trim() === shown || label.trim() === url ? shown : `${label} (${shown})`;
    })
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '$1')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1$2');
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'button'; label: string; url: string };

/** The message as paragraphs, lists and buttons. A blank line ends a block. */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of normalizeBody(body).split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const button = BUTTON_LINE.exec(line);
    if (button && isSafeLinkUrl(button[2])) {
      flush();
      blocks.push({ kind: 'button', label: button[1], url: button[2] });
      continue;
    }
    const bullet = BULLET_LINE.exec(line);
    const number = bullet ? null : NUMBER_LINE.exec(line);
    if (bullet) {
      if (current?.kind !== 'bullets') {
        flush();
        current = { kind: 'bullets', items: [] };
      }
      current.items.push(bullet[1]);
      continue;
    }
    if (number) {
      if (current?.kind !== 'numbers') {
        flush();
        current = { kind: 'numbers', items: [] };
      }
      current.items.push(number[1]);
      continue;
    }
    if (current?.kind !== 'paragraph') {
      flush();
      current = { kind: 'paragraph', lines: [] };
    }
    current.lines.push(line);
  }
  flush();
  return blocks;
}

const PARAGRAPH_STYLE = `margin:0 0 16px;color:${INK};font-size:15px;line-height:1.65;`;

function blockHtml(block: Block): string {
  switch (block.kind) {
    case 'paragraph':
      return `<p style="${PARAGRAPH_STYLE}">${block.lines.map(inlineHtml).join('<br>')}</p>`;
    case 'bullets':
    case 'numbers': {
      const tag = block.kind === 'bullets' ? 'ul' : 'ol';
      const items = block.items
        .map((item) => `<li style="margin:0 0 6px;padding-left:4px;">${inlineHtml(item)}</li>`)
        .join('');
      return `<${tag} style="margin:0 0 16px;padding-left:24px;color:${INK};font-size:15px;line-height:1.6;">${items}</${tag}>`;
    }
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td style="background:${NAVY};border-radius:8px;"><a href="${escapeHtml(block.url.trim())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;border-bottom:3px solid ${GOLD};">${escapeHtml(block.label)}</a></td></tr></table>`;
  }
}

function blockText(block: Block): string {
  switch (block.kind) {
    case 'paragraph':
      return block.lines.map(inlineText).join('\n');
    case 'bullets':
      return block.items.map((item) => `- ${inlineText(item)}`).join('\n');
    case 'numbers':
      return block.items.map((item, index) => `${index + 1}. ${inlineText(item)}`).join('\n');
    case 'button':
      return `${block.label}: ${block.url.replace(/^mailto:|^tel:/i, '')}`;
  }
}

// ---------------------------------------------------------------------------
// The email

const OPT_OUT_LINE =
  "Not the right fit? Just reply and let me know, and I won't email you again.";

function footerAddress(postalAddress: string | null): string {
  const address = postalAddress?.trim();
  return address ? `Boxed2Built LLC, ${address}` : 'Boxed2Built LLC, Spring Hill, TN';
}

const CARD_TAGLINE = 'Furniture assembly & TV mounting · Spring Hill, TN';

export interface RenderedOutreach {
  subject: string;
  text: string;
  html: string;
}

export function renderOutreach({ subject, body, postalAddress }: OutreachInput): RenderedOutreach {
  const cleanSubject = normalizeSubject(subject);
  const blocks = parseBlocks(withClosing(body));
  const website = OUTREACH_WEBSITE.replace(/^https:\/\//, '');

  const text = [
    blocks.map(blockText).join('\n\n'),
    '',
    'Boxed2Built',
    CARD_TAGLINE.replace('·', '-'),
    OUTREACH_PHONE,
    OUTREACH_FROM_EMAIL,
    `${OUTREACH_WEBSITE}/`,
    '',
    socialFooterText(),
    '',
    '--',
    OPT_OUT_LINE,
    footerAddress(postalAddress),
  ].join('\n');

  const header = `<tr><td style="padding:0 0 20px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;padding-right:12px;"><a href="${OUTREACH_WEBSITE}/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;"><img src="${OUTREACH_WEBSITE}/boxed2built_logo_email.png" width="56" height="56" alt="Boxed2Built" style="display:block;width:56px;height:56px;border:0;outline:none;color:${NAVY};font-size:16px;font-weight:800;"></a></td>
    <td style="vertical-align:middle;"><a href="${OUTREACH_WEBSITE}/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:${NAVY};font-size:20px;font-weight:800;letter-spacing:-0.3px;">Boxed2Built</a></td>
  </tr></table>
  <div style="height:4px;line-height:4px;font-size:0;background:${NAVY};border-radius:4px;margin-top:16px;"><div style="width:72px;height:4px;background:${GOLD};border-radius:4px;font-size:0;line-height:0;">&nbsp;</div></div>
</td></tr>`;

  const message = `<tr><td style="padding:4px 0 8px;">
${blocks.map(blockHtml).join('\n')}
</td></tr>`;

  const card = `<tr><td style="padding:12px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid ${LINE};border-left:4px solid ${GOLD};border-radius:8px;">
    <tr><td style="padding:14px 18px;font-size:14px;line-height:1.6;color:${INK};">
      <div style="color:${NAVY};font-size:15px;font-weight:800;">Boxed2Built</div>
      <div style="color:${MUTED};font-size:13px;margin-bottom:6px;">${escapeHtml(CARD_TAGLINE)}</div>
      <a href="${OUTREACH_PHONE_HREF}" style="color:${INK};text-decoration:none;">${escapeHtml(OUTREACH_PHONE)}</a>
      &nbsp;&middot;&nbsp; <a href="mailto:${OUTREACH_FROM_EMAIL}" style="color:${LINK};text-decoration:none;">${OUTREACH_FROM_EMAIL}</a><br>
      <a href="${OUTREACH_WEBSITE}/" target="_blank" rel="noopener noreferrer" style="color:${LINK};font-weight:700;text-decoration:underline;">${website}</a>
    </td></tr>
  </table>
</td></tr>`;

  const footer = `<tr><td style="padding:0;">
${socialFooterHtml('light')}
  <p style="margin:0;padding-top:12px;border-top:1px solid ${LINE};color:#9ca3af;font-size:12px;line-height:1.6;">${escapeHtml(OPT_OUT_LINE)}<br>${escapeHtml(footerAddress(postalAddress))}</p>
</td></tr>`;

  // Branded, but light: white page, logo and a navy-and-gold rule, the brand's
  // links and buttons, the social icons. It still reads as a note from one
  // local business to another rather than a newsletter, which keeps it out of
  // Promotions more often than the full navy-header layout would.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(cleanSubject)}</title></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT};">
${header}
${message}
${card}
${footer}
</table>
</body></html>`;

  return { subject: cleanSubject, text, html };
}

/** For tests and the page: the social profiles the footer links to. */
export const OUTREACH_SOCIAL_LINKS = SOCIAL_LINKS;

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
