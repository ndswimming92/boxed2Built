/**
 * The customer's "your appointment is tomorrow" email: subject, HTML, plain
 * text, and the calendar attachment that rides along.
 *
 * Pure rendering, no Deno or Supabase imports, so `tests/unit` can read the
 * finished email back and assert on it. The edge function that calls this does
 * the database and Resend work and nothing else.
 *
 * This is the customer's copy. The business gets a different email entirely
 * (send-job-schedule-email), which carries the leave-by drive time and a link
 * into the admin — none of that belongs here.
 */

import { buildIcsCalendar, resolveTimedRange, type IcsEvent } from './ics.ts';
import { buildJobPrep } from './jobPrep.ts';
import { describeProximity } from './customerReminder.ts';
import {
  formatScheduleDate,
  formatScheduleTime,
  formatScheduleWhen,
  normalizeScheduleTime,
} from './scheduleLabels.ts';

/** The job fields the email actually reads. A `date_scheduled` is a precondition. */
export interface ReminderJob {
  id: string;
  client_name: string;
  job_type: string | null;
  job_description: string | null;
  date_scheduled: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  client_address: string | null;
  service_address: string | null;
  location_city: string | null;
  quoted_price: number | null;
  customer_reminder_ics_sequence: number | null;
}

/** Resolved once per business, then reused across every job it owns. */
export interface ReminderBusiness {
  name: string;
  email: string | null;
  /** Display form, e.g. '(423) 368-3950'. */
  phone: string | null;
  /** tel: form, e.g. '+14233683950'. */
  phoneHref: string | null;
  timeZone: string;
  /** Active payment methods, in display order. */
  paymentMethods: string[];
}

export interface RenderOptions {
  now: Date;
  siteUrl: string;
}

export interface RenderedReminder {
  subject: string;
  html: string;
  text: string;
  /** iCalendar source; the caller base64s it into the attachment. */
  ics: string;
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "Kurt Zollner" -> "Kurt". Falls back to "there" rather than an empty greeting. */
export function firstName(clientName: string): string {
  return clientName.trim().split(/\s+/)[0] || 'there';
}

/** "Same as client address" is stored as a null service address. */
export function resolveLocation(job: ReminderJob): string {
  const address = job.service_address?.trim() || job.client_address?.trim();
  if (address) return address.replace(/\s*\n\s*/g, ', ');
  return job.location_city?.trim() || '';
}

/** ['Cash'] -> 'Cash'; ['Cash','Card','Zelle'] -> 'Cash, Card, and Zelle'. */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** "about 2 hours 30 minutes" from the scheduled range; null unless both times are usable. */
export function describeDuration(job: ReminderJob): string | null {
  const start = normalizeScheduleTime(job.scheduled_start_time);
  const end = normalizeScheduleTime(job.scheduled_end_time);
  if (!start || !end || end <= start) return null;

  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const total = toMinutes(end) - toMinutes(start);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  return parts.length ? `about ${parts.join(' ')}` : null;
}

/** The sentence that opens the email, and the one the subject line echoes. */
export function describeArrival(
  job: ReminderJob,
  timeZone: string,
  now: Date,
): { proximity: string; arrival: string; subject: string } {
  const nearness = describeProximity(job.date_scheduled, timeZone, now);
  const prettyDate = formatScheduleDate(job.date_scheduled);
  const startTime = formatScheduleTime(job.scheduled_start_time);
  const jobType = job.job_type?.trim() || 'appointment';

  // A job more than a day out names its date; 'on Saturday, September 26' reads
  // naturally after "See you", where a bare 'tomorrow' needs no preposition.
  const when = nearness ?? `on ${prettyDate}`;
  const at = startTime ? ` at ${startTime}` : '';

  return {
    proximity: nearness ? `${nearness.charAt(0).toUpperCase()}${nearness.slice(1)}` : prettyDate,
    arrival: `${when}${at}`,
    subject: `Reminder: your ${jobType} appointment is ${nearness ?? prettyDate}${at}`,
  };
}

function buildText(
  job: ReminderJob,
  business: ReminderBusiness,
  options: RenderOptions,
): string {
  const location = resolveLocation(job);
  const { arrival } = describeArrival(job, business.timeZone, options.now);
  const startTime = formatScheduleTime(job.scheduled_start_time);
  const duration = describeDuration(job);
  const prep = buildJobPrep(job.job_type);
  const jobType = job.job_type?.trim() || 'your job';

  const lines = [
    `Hi ${firstName(job.client_name)},`,
    '',
    `This is a reminder that I'll be out ${arrival} for your ${jobType}.`,
    '',
    '--- The details ---',
    `When: ${formatScheduleWhen(job.date_scheduled, job.scheduled_start_time, job.scheduled_end_time)}`,
  ];
  if (startTime) lines.push(`Arriving: ${startTime}`);
  if (duration) lines.push(`Expected to take: ${duration}`);
  if (location) lines.push(`Where: ${location}`);
  lines.push(`Work: ${jobType}`);
  if (job.job_description) lines.push(`Details: ${job.job_description.trim()}`);
  if (typeof job.quoted_price === 'number') lines.push(`Estimate: $${job.quoted_price.toFixed(2)}`);

  if (location) {
    lines.push(
      '',
      `Please double-check that address. If it is not right, ${
        business.phone ? 'reply to this email or call' : 'reply to this email'
      } and I will get it corrected before I head out.`,
    );
  }

  lines.push('', `--- ${prep.intro} ---`);
  prep.items.forEach((item) => lines.push(`- ${item}`));

  if (typeof job.quoted_price === 'number') {
    lines.push(
      '',
      'The estimate above covers the scope we discussed. If anything changes once I see the work in person, I will talk it through with you before doing it — no surprise charges.',
    );
  }
  if (business.paymentMethods.length) {
    lines.push(
      '',
      `Payment is due when the work is finished. I accept ${joinList(business.paymentMethods)}.`,
    );
  }

  lines.push(
    '',
    '--- Need to change something? ---',
    business.phone
      ? `Reply to this email or call ${business.phone}. If you need to reschedule, the sooner you let me know the easier it is to move things around.`
      : 'Just reply to this email. If you need to reschedule, the sooner you let me know the easier it is to move things around.',
    '',
    'The attached appointment.ics adds this to your calendar.',
    '',
    'Looking forward to it,',
    business.name,
  );
  if (business.phone) lines.push(business.phone);
  lines.push(options.siteUrl);

  // Collapse the runs of blanks left by the optional sections above.
  return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
}

function buildHtml(
  job: ReminderJob,
  business: ReminderBusiness,
  options: RenderOptions,
): string {
  const location = resolveLocation(job);
  const { proximity, arrival } = describeArrival(job, business.timeZone, options.now);
  const prettyDate = formatScheduleDate(job.date_scheduled);
  const startTime = formatScheduleTime(job.scheduled_start_time);
  const duration = describeDuration(job);
  const prep = buildJobPrep(job.job_type);
  const jobType = job.job_type?.trim() || 'Your job';
  const siteUrl = options.siteUrl;

  const rows: Array<[string, string]> = [['Date', prettyDate]];
  if (startTime) rows.push(['Arriving', startTime]);
  if (duration) rows.push(['Expected to take', duration]);
  if (location) rows.push(['Address', location]);
  rows.push(['Work', jobType]);
  if (job.job_description) rows.push(['Details', job.job_description.trim()]);
  if (typeof job.quoted_price === 'number') {
    rows.push(['Estimate', `$${job.quoted_price.toFixed(2)}`]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;border-bottom:1px solid #f3f4f6;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${escapeHtml(value)}</td>
          </tr>`,
    )
    .join('');

  const prepHtml = prep.items
    .map(
      (item) =>
        `<li style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(item)}</li>`,
    )
    .join('');

  // The arrival time is the one thing the customer opened this email to find,
  // so it gets the banner rather than a row in the table.
  const arrivalHeadline = escapeHtml(startTime ?? prettyDate);
  const arrivalSubline = startTime
    ? `${escapeHtml(proximity)}${duration ? ` &middot; ${escapeHtml(duration)}` : ''}`
    : 'I will confirm a time with you before the day';

  const addressHtml = location
    ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 22px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#1e40af;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Please confirm the address</p>
          <p style="margin:0 0 8px;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(location)}</p>
          <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.6;">If that is not right, ${
            business.phone ? 'reply to this email or give me a call' : 'reply to this email'
          } and I will get it corrected before I head out.</p>
        </div>`
    : '';

  const estimateHtml = typeof job.quoted_price === 'number'
    ? `<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">Your estimate is <strong>$${escapeHtml(job.quoted_price.toFixed(2))}</strong>, covering the scope we discussed. If anything changes once I see the work in person, I will talk it through with you before doing it &mdash; no surprise charges.</p>`
    : '';

  const paymentHtml = business.paymentMethods.length
    ? `<p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">Payment is due when the work is finished. I accept <strong>${escapeHtml(joinList(business.paymentMethods))}</strong>.</p>`
    : '';

  const moneyHtml = estimateHtml || paymentHtml
    ? `
        <div style="background:#f9fafb;border-radius:8px;padding:20px 22px;margin:24px 0;">
          <p style="margin:0 0 10px;color:#111827;font-size:14px;font-weight:700;">Estimate &amp; payment</p>
          ${estimateHtml}
          ${paymentHtml}
        </div>`
    : '';

  const contactLine = business.phone
    ? `Reply to this email or call <a href="tel:${escapeHtml(business.phoneHref ?? '')}" style="color:#1e3a5f;font-weight:600;">${escapeHtml(business.phone)}</a>.`
    : 'Just reply to this email and it comes straight to me.';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">See you ${escapeHtml(arrival)}</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${escapeHtml(jobType)} &middot; ${escapeHtml(business.name)}</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">

        <p style="margin:0 0 22px;color:#374151;font-size:15px;line-height:1.7;">Hi ${escapeHtml(firstName(job.client_name))}, this is a quick reminder about your upcoming appointment. Here is everything you need to know.</p>

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px 24px;margin-bottom:8px;">
          <p style="margin:0 0 6px;color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">I&#39;ll arrive at</p>
          <p style="margin:0;color:#111827;font-size:30px;font-weight:700;line-height:1.2;">${arrivalHeadline}</p>
          <p style="margin:6px 0 0;color:#166534;font-size:13px;line-height:1.6;">${arrivalSubline}</p>
        </div>

        ${addressHtml}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">${rowsHtml}</table>

        <div style="margin-top:28px;">
          <p style="margin:0 0 14px;color:#111827;font-size:15px;font-weight:700;">${escapeHtml(prep.intro)}</p>
          <ul style="margin:0;padding-left:20px;">${prepHtml}</ul>
        </div>

        ${moneyHtml}

        <div style="border-top:1px solid #e5e7eb;padding-top:22px;margin-top:8px;">
          <p style="margin:0 0 8px;color:#111827;font-size:15px;font-weight:700;">Need to change something?</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${contactLine} If you need to reschedule, the sooner you let me know the easier it is to move things around.</p>
        </div>

      </td></tr>

      <tr><td style="background:#ffffff;padding:0 32px 28px;border-radius:0 0 12px 12px;">
        <p style="margin:0;padding-top:18px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6;">
          The attached <strong>appointment.ics</strong> adds this to your calendar. You are receiving this because you have a scheduled appointment with ${escapeHtml(business.name)} &mdash; <a href="${escapeHtml(siteUrl)}" style="color:#6b7280;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** The customer's own calendar entry — no pricing, no internal links. */
function buildIcs(job: ReminderJob, business: ReminderBusiness, siteUrl: string): string {
  const location = resolveLocation(job);
  const jobType = job.job_type?.trim() || 'Appointment';

  const descriptionParts = [`${jobType} with ${business.name}.`];
  if (job.job_description) descriptionParts.push('', job.job_description.trim());
  if (business.phone) descriptionParts.push('', `Questions: ${business.phone}`);

  const event: IcsEvent = {
    // Distinct from the internal invite's UID (job-<id>@) so the two never
    // collide in a calendar that somehow sees both.
    uid: `job-${job.id}-customer@boxed2built.com`,
    // Bumped per send, so a reschedule replaces the customer's existing entry
    // rather than leaving them with two.
    sequence: (job.customer_reminder_ics_sequence ?? 0) + 1,
    startDate: job.date_scheduled,
    startTime: job.scheduled_start_time,
    endTime: job.scheduled_end_time,
    timeZone: business.timeZone,
    summary: `${business.name} — ${jobType}`,
    description: descriptionParts.join('\n'),
    location: location || undefined,
    url: siteUrl,
  };

  // An all-day event's DTSTART is local midnight, so '-PT2H' would fire at 10pm
  // the night before; a positive trigger puts it at a civil hour instead.
  const isTimed = resolveTimedRange(event) !== null;
  event.alarms = [
    {
      trigger: isTimed ? '-PT2H' : 'PT8H',
      description: `${jobType} with ${business.name}`,
    },
  ];

  return buildIcsCalendar([event], { method: 'PUBLISH' });
}

export function renderCustomerReminder(
  job: ReminderJob,
  business: ReminderBusiness,
  options: RenderOptions,
): RenderedReminder {
  return {
    subject: describeArrival(job, business.timeZone, options.now).subject,
    html: buildHtml(job, business, options),
    text: buildText(job, business, options),
    ics: buildIcs(job, business, options.siteUrl),
  };
}
