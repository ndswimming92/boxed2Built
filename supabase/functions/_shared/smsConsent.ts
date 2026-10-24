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

/**
 * Whether a number may get service texts (confirmations, reminders, quotes,
 * invoices). Marketing consent is a separate box and is not consulted here.
 */
export function decideSmsConsent(
  log: ConsentLogRow[],
  keywordStatus: KeywordStatusRow[],
): ConsentDecision {
  let lastOptIn = NaN;
  let lastOptOut = NaN;

  for (const row of log) {
    const at = time(row.consent_given_at) || time(row.created_at);
    if (!Number.isFinite(at)) continue;
    if (row.event_type === 'opt_in' && row.service_texts === true) {
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
 * (VALIDATION_008), and short enough not to blow up the SMS segment count.
 */
export function smsValue(value: string | null | undefined, maxLength = 120): string {
  const flat = (value ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}

/** Sent ignores an Idempotency-Key with other characters or over 255 long. */
export function idempotencyKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .map((part) => String(part).replace(/[^A-Za-z0-9_-]+/g, '-'))
    .join('_')
    .slice(0, 255);
}

/** "Saturday, October 25" + " at 10:00 AM" when there is a time. */
export function describeAppointment(dateLabel: string, timeLabel: string | null | undefined): string {
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
}
