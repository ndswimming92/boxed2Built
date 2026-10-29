/**
 * Who may be texted, and how values are shaped for a Sent template.
 *
 * Kept free of Deno APIs so `node --test` can import it; the network and
 * database side lives in sentSms.ts.
 *
 * Consent comes from two places, both keyed on the last ten digits of the
 * number:
 *   - sms_consent_log: the website opt-in (with the box that was ticked) and
 *     opt-outs an admin records by hand.
 *   - sms_contact_status: STOP / START the customer texted to Sent, kept in
 *     sync by the sent-webhook function.
 * The most recent signal wins. Without a service opt-in on record a number is
 * never texted, however recent a START.
 */

export interface ConsentLogRow {
  event_type: 'opt_in' | 'opt_out' | string;
  service_texts: boolean | null;
  /** The promotional box. Only consulted for promotional texts; absent rows count as unticked. */
  marketing_texts?: boolean | null;
  /** When the person agreed, if the row carries it; otherwise when it was logged. */
  consent_given_at: string | null;
  created_at: string;
}

export interface KeywordStatusRow {
  opted_out: boolean;
  last_signal_at: string;
}

export type ConsentReason = 'no_opt_in' | 'opted_out';

export type ConsentDecision = { allowed: true } | { allowed: false; reason: ConsentReason };

const time = (iso: string | null | undefined): number => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : NaN;
};

export type ConsentKind = 'service' | 'marketing';

/**
 * Whether a number may get a text of this kind. Service texts (confirmations,
 * reminders, quotes, invoices) need the service box; promotional texts (offers,
 * and the referral code that carries a discount) need the separate promotional
 * box, and a service opt-in alone never covers them. A STOP ends both.
 */
export function decideSmsConsent(
  log: ConsentLogRow[],
  keywordStatus: KeywordStatusRow[],
  kind: ConsentKind = 'service',
): ConsentDecision {
  let lastOptIn = NaN;
  let lastOptOut = NaN;

  for (const row of log) {
    const at = time(row.consent_given_at) || time(row.created_at);
    if (!Number.isFinite(at)) continue;
    const agreed = kind === 'marketing' ? row.marketing_texts === true : row.service_texts === true;
    if (row.event_type === 'opt_in' && agreed) {
      lastOptIn = Number.isFinite(lastOptIn) ? Math.max(lastOptIn, at) : at;
    } else if (row.event_type === 'opt_out') {
      lastOptOut = Number.isFinite(lastOptOut) ? Math.max(lastOptOut, at) : at;
    }
  }

  // A START restores a number that had opted in on the website before; it is
  // not a first opt-in on its own.
  if (!Number.isFinite(lastOptIn)) return { allowed: false, reason: 'no_opt_in' };

  for (const row of keywordStatus) {
    const at = time(row.last_signal_at);
    if (!Number.isFinite(at)) continue;
    if (row.opted_out) {
      lastOptOut = Number.isFinite(lastOptOut) ? Math.max(lastOptOut, at) : at;
    } else {
      lastOptIn = Math.max(lastOptIn, at);
    }
  }

  // A tie goes to the opt-out, the same rule apply_sms_consent_signal uses.
  if (Number.isFinite(lastOptOut) && lastOptOut >= lastOptIn) {
    return { allowed: false, reason: 'opted_out' };
  }
  return { allowed: true };
}

/**
 * Whether it is a reasonable hour to text someone: from `startHour` up to, not
 * including, `endHour` in the business's own time zone (8am to 9pm by default,
 * the window the rules for promotional texts allow).
 */
export function withinTextingHours(now: Date, timeZone: string, startHour = 8, endHour = 21): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  return hour >= startHour && hour < endHour;
}

/** "(615) 403-4538", "615.403.4538", "+1 615 403 4538" -> "+16154034538". US numbers only. */
export function toUsE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  // NANP: area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(local)) return null;
  return `+1${local}`;
}

/** The ten digits consent rows are keyed on. */
export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, '').slice(-10);
}

/**
 * A template value Sent will accept: no newlines or tabs, no runs of spaces
 * (VALIDATION_008), and short enough not to blow up the SMS segment count. A cut
 * value ends in three plain dots: a single "…" is outside the standard SMS
 * alphabet and would make the whole message bill at 70 characters a segment.
 */
export function smsValue(value: string | null | undefined, maxLength = 120): string {
  const flat = (value ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 3).trimEnd()}...` : flat;
}

/** Sent ignores an Idempotency-Key with other characters or over 255 long. */
export function idempotencyKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map((part) => String(part).replace(/[^A-Za-z0-9_-]+/g, '-'))
    .join('_')
    .slice(0, 255);
}

/**
 * The site's request lookup page, opened with a booking's reference and the
 * customer's email already filled in (it finds a BK- reference too). A missing
 * email still gives a working link; the customer types it in.
 */
export function bookingLookupLink(siteUrl: string, reference: string, email?: string | null): string {
  const base = siteUrl.replace(/\/+$/, '');
  const emailPart = email?.trim() ? `&email=${encodeURIComponent(email.trim().toLowerCase())}` : '';
  return `${base}/lookup-request?code=${encodeURIComponent(reference.trim().toUpperCase())}${emailPart}`;
}

/** "Saturday, October 25" + " at 10:00 AM" when there is a time. */
export function describeAppointment(dateLabel: string, timeLabel: string | null | undefined): string {
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
}
