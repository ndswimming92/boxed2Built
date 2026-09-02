import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { escapeIcsText, foldIcsLine, icsToBase64, toIcsTimestamp } from '../_shared/ics.ts';

/**
 * Booking notifications: the owner hears about a new request, the customer
 * hears back when it is accepted or declined.
 *
 * Unlike the job schedule mail this sends a *timed* calendar event, so the ICS
 * is assembled here rather than through buildIcsCalendar(), which only writes
 * all-day events. The fiddly parts — line folding and TEXT escaping — are still
 * the shared implementation.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';

type BookingEvent = 'created' | 'confirmed' | 'declined';

interface Payload {
  bookingId?: string;
  event?: BookingEvent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Milliseconds a zone is ahead of UTC at a given instant. Formatting the
 * instant *in* the zone and reading the wall clock back is the only way to get
 * this without shipping a timezone database.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const hour = get('hour') === 24 ? 0 : get('hour');

  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) -
    instant.getTime()
  );
}

/**
 * '2026-09-14' + '13:00:00' in America/Chicago -> the matching UTC instant.
 * The offset is resolved twice because the first guess can land on the wrong
 * side of a DST change, which would put the appointment an hour out.
 */
function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);

  let instant = new Date(wallClock - zoneOffsetMs(new Date(wallClock), timeZone));
  instant = new Date(wallClock - zoneOffsetMs(instant, timeZone));

  return instant;
}

function toIcsUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function formatLongDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(time: string): string {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteText} ${period}`;
}

interface BookingRow {
  id: string;
  business_id: string;
  reference: string;
  auth_user_id: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  service_address: string | null;
  service_name: string | null;
  pieces: number | null;
  notes: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  decision_note: string | null;
}

function buildTimedIcs(booking: BookingRow, businessName: string, cancelled: boolean): string {
  const start = zonedToUtc(booking.booking_date, booking.start_time, booking.timezone);
  const end = zonedToUtc(booking.booking_date, booking.end_time, booking.timezone);

  const summary = `${businessName} — ${booking.service_name ?? 'Furniture assembly'}`;
  const description = [
    `Reference ${booking.reference}`,
    booking.pieces ? `${booking.pieces} piece(s)` : '',
    booking.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Boxed2Built//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@boxed2built.com`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART:${toIcsUtcStamp(start)}`,
    `DTEND:${toIcsUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    booking.service_address ? `LOCATION:${escapeIcsText(booking.service_address)}` : '',
    `URL:${SITE_URL}/book`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function bookingSummaryHtml(booking: BookingRow): string {
  const rows: Array<[string, string]> = [
    ['When', `${formatLongDate(booking.booking_date)}, ${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`],
    ['Reference', booking.reference],
    ['Name', booking.customer_name],
    ['Email', booking.customer_email],
  ];

  if (booking.customer_phone) rows.push(['Phone', booking.customer_phone]);
  if (booking.service_name) rows.push(['Service', booking.service_name]);
  if (booking.pieces) rows.push(['Pieces', String(booking.pieces)]);
  if (booking.service_address) rows.push(['Address', booking.service_address]);
  if (booking.notes) rows.push(['Notes', booking.notes]);

  return `<table style="border-collapse:collapse;font-size:15px;color:#0f172a">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top">${escapeHtml(
          label,
        )}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</table>`;
}

function wrap(title: string, intro: string, body: string, footer = ''): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569">${escapeHtml(intro)}</p>
    ${body}
    ${footer ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b">${escapeHtml(footer)}</p>` : ''}
  </div>
</body></html>`;
}

async function sendEmail(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('send-booking-email: Resend rejected the send', response.status, detail);
    throw new Error('Email provider rejected the send');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ error: 'Email is not configured' }, 500);
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Unauthorized' }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { bookingId, event } = payload;
  if (!bookingId || !event) {
    return json({ error: 'bookingId and event are required' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // The anon key is itself a valid JWT, so the bearer has to resolve to a real
  // user before it means anything.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle<BookingRow>();

  if (bookingError || !booking) return json({ error: 'Booking not found' }, 404);

  // Either the person who made the booking, or an admin acting on it.
  const appMeta = (userData.user.app_metadata || {}) as Record<string, unknown>;
  const isAdmin = appMeta.is_platform_admin === true || appMeta.is_platform_admin === 'true';

  if (!isAdmin && booking.auth_user_id !== userData.user.id) {
    return json({ error: 'Forbidden' }, 403);
  }

  // A customer may only announce their own new booking; the accept/decline
  // notices are the owner's to send.
  if (!isAdmin && event !== 'created') {
    return json({ error: 'Forbidden' }, 403);
  }

  const [{ data: business }, { data: settings }] = await Promise.all([
    admin.from('business_info').select('name, email').eq('id', booking.business_id).maybeSingle(),
    admin.from('booking_settings').select('notify_email').eq('business_id', booking.business_id).maybeSingle(),
  ]);

  const businessName = business?.name?.trim() || 'Boxed2Built';
  const from = `${businessName} <${FROM_EMAIL}>`;
  const when = `${formatLongDate(booking.booking_date)} at ${formatTime(booking.start_time)}`;

  try {
    if (event === 'created') {
      const ownerInbox = settings?.notify_email?.trim() || business?.email?.trim() || FROM_EMAIL;

      await sendEmail({
        from,
        to: [ownerInbox],
        subject: `New booking ${booking.status === 'pending' ? 'request' : ''}: ${booking.customer_name} — ${when}`.replace(/\s+/g, ' '),
        html: wrap(
          booking.status === 'pending' ? 'A customer is holding a slot' : 'A customer booked a slot',
          booking.status === 'pending'
            ? 'It is held until you confirm or decline it.'
            : 'It is already on your Jobs calendar.',
          bookingSummaryHtml(booking),
          `Open ${SITE_URL}/admin/bookings to act on it.`,
        ),
        reply_to: booking.customer_email,
      });

      await sendEmail({
        from,
        to: [booking.customer_email],
        subject:
          booking.status === 'pending'
            ? `We're holding ${when} for you`
            : `You're booked for ${when}`,
        html: wrap(
          booking.status === 'pending' ? 'Your time is held' : "You're booked",
          booking.status === 'pending'
            ? 'Thanks for booking with us. We will confirm this shortly.'
            : 'Thanks for booking with us. See you then.',
          bookingSummaryHtml(booking),
          'Reply to this email if anything changes.',
        ),
        reply_to: FROM_EMAIL,
        // A pending slot is not an appointment yet, so no invite goes out until
        // it is confirmed — otherwise a decline leaves a ghost in their calendar.
        attachments:
          booking.status === 'confirmed'
            ? [
                {
                  filename: 'booking.ics',
                  content: icsToBase64(buildTimedIcs(booking, businessName, false)),
                  content_type: 'text/calendar; charset=utf-8; method=REQUEST',
                },
              ]
            : undefined,
      });

      return json({ success: true, notified: [ownerInbox, booking.customer_email] });
    }

    if (event === 'confirmed') {
      await sendEmail({
        from,
        to: [booking.customer_email],
        subject: `Confirmed: ${when}`,
        html: wrap(
          "You're confirmed",
          `We will see you on ${when}.`,
          bookingSummaryHtml(booking),
          'The attached invite adds it to your calendar.',
        ),
        reply_to: FROM_EMAIL,
        attachments: [
          {
            filename: 'booking.ics',
            content: icsToBase64(buildTimedIcs(booking, businessName, false)),
            content_type: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      });

      return json({ success: true, notified: [booking.customer_email] });
    }

    await sendEmail({
      from,
      to: [booking.customer_email],
      subject: `About your ${formatLongDate(booking.booking_date)} booking`,
      html: wrap(
        'We could not make that time work',
        booking.decision_note?.trim()
          ? booking.decision_note.trim()
          : 'Sorry — that slot has not worked out. Please pick another time and we will get you booked in.',
        bookingSummaryHtml(booking),
        `Book another time at ${SITE_URL}/book`,
      ),
      reply_to: FROM_EMAIL,
    });

    return json({ success: true, notified: [booking.customer_email] });
  } catch (error) {
    return json({ error: (error as Error).message }, 502);
  }
});
