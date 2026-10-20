import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { renderDigestEmail, type DigestSale } from '../_shared/salesDigestEmail.ts';
import { unsubscribeHeaders, unsubscribePageUrl } from '../_shared/salesSubscribers.ts';

/**
 * The daily "new sales" email.
 *
 * Run hourly by cron; it only does anything at 8 AM Central (pass
 * `{ "force": true }` to run at any hour). Each active subscriber gets the
 * sales published since their own `last_digest_at`, skipping any that have
 * already ended, and nobody is emailed when there is nothing new.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const FROM_EMAIL = 'team@boxed2built.com';
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://boxed2built.com').replace(/\/+$/, '');

const SEND_HOUR = 8;
const TIME_ZONE = 'America/Chicago';
/** Resend's batch endpoint takes up to 100; a smaller chunk keeps a rejected batch cheap to retry. */
const BATCH_SIZE = 50;
const PAGE_SIZE = 1000;

const SALE_COLUMNS =
  'id, organization_id, title, summary, store_name, sale_scope, ends_on, source_url, published_at';

interface Subscriber {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  unsubscribe_token: string;
  last_digest_at: string;
}

interface SaleRow extends DigestSale {
  organization_id: string;
  published_at: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function centralParts(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** Soonest-ending first, as on the Sales tab; sales with no end date last, newest first. */
function bySoonestEnding(a: SaleRow, b: SaleRow): number {
  if (a.ends_on && b.ends_on && a.ends_on !== b.ends_on) return a.ends_on < b.ends_on ? -1 : 1;
  if (a.ends_on && !b.ends_on) return -1;
  if (!a.ends_on && b.ends_on) return 1;
  return a.published_at < b.published_at ? 1 : -1;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    if (!RESEND_API_KEY) return json({ error: 'Email is not configured (RESEND_API_KEY missing).' }, 500);

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const runStart = new Date();
    const central = centralParts(runStart);
    if (!force && central.hour !== SEND_HOUR) {
      return json({ sent: 0, skipped: `Not the send hour (${central.hour}:00 Central)` });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const subscribers: Subscriber[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from('sale_subscribers')
        .select('id, organization_id, name, email, unsubscribe_token, last_digest_at')
        .eq('status', 'active')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
        .returns<Subscriber[]>();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      subscribers.push(...data);
    }
    if (subscribers.length === 0) return json({ sent: 0, subscribers: 0 });

    // One read of the sales per organization, from the oldest "sent through"
    // mark in it. Each subscriber then takes the slice after their own mark.
    const salesByOrg = new Map<string, SaleRow[]>();
    for (const orgId of new Set(subscribers.map((s) => s.organization_id))) {
      const oldest = subscribers
        .filter((s) => s.organization_id === orgId)
        .reduce((min, s) => (s.last_digest_at < min ? s.last_digest_at : min), runStart.toISOString());

      // Read in pages: the API caps a response, and a capped read would drop
      // the older sales and then advance everyone's mark past them.
      const orgSales: SaleRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await admin
          .from('news_items')
          .select(SALE_COLUMNS)
          .eq('organization_id', orgId)
          .eq('topic', 'deals')
          .eq('status', 'published')
          .gt('published_at', oldest)
          .lte('published_at', runStart.toISOString())
          // Ended sales stay "published" but are hidden from the site the day after.
          .or(`ends_on.is.null,ends_on.gte.${central.date}`)
          .order('published_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
          .returns<SaleRow[]>();
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        orgSales.push(...data);
      }
      salesByOrg.set(orgId, orgSales);
    }

    interface Pending {
      subscriber: Subscriber;
      sales: SaleRow[];
    }
    const pending: Pending[] = [];
    for (const subscriber of subscribers) {
      const sales = (salesByOrg.get(subscriber.organization_id) ?? [])
        .filter((sale) => sale.published_at > subscriber.last_digest_at)
        .sort(bySoonestEnding);
      if (sales.length > 0) pending.push({ subscriber, sales });
    }
    if (pending.length === 0) return json({ sent: 0, subscribers: subscribers.length, newSales: 0 });

    let sent = 0;
    let failed = 0;
    const runStamp = runStart.toISOString();

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const chunk = pending.slice(i, i + BATCH_SIZE);

      // Claim each person before sending. An overlapping tick or a retry would
      // otherwise mail the same sales twice; the claim only succeeds for the
      // run that still sees their old mark.
      const claimed: Pending[] = [];
      for (const item of chunk) {
        const { data } = await admin
          .from('sale_subscribers')
          .update({ last_digest_at: runStamp })
          .eq('id', item.subscriber.id)
          .eq('last_digest_at', item.subscriber.last_digest_at)
          .eq('status', 'active')
          .select('id')
          .maybeSingle();
        if (data) claimed.push(item);
      }
      if (claimed.length === 0) continue;

      const release = async () => {
        for (const item of claimed) {
          await admin
            .from('sale_subscribers')
            .update({ last_digest_at: item.subscriber.last_digest_at })
            .eq('id', item.subscriber.id)
            .eq('last_digest_at', runStamp);
        }
      };

      const emails = claimed.map(({ subscriber, sales }) => {
        const rendered = renderDigestEmail({
          name: subscriber.name,
          sales,
          siteUrl: SITE_URL,
          unsubscribeUrl: unsubscribePageUrl(SITE_URL, subscriber.unsubscribe_token),
        });
        return {
          from: `Boxed2Built <${FROM_EMAIL}>`,
          to: [subscriber.email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          reply_to: REPLY_TO_EMAIL,
          headers: unsubscribeHeaders(SUPABASE_URL, SITE_URL, subscriber.unsubscribe_token),
        };
      });

      try {
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emails),
        });
        if (!response.ok) {
          console.error('send-sales-digest: Resend rejected the batch', response.status, await response.text());
          await release();
          failed += claimed.length;
          continue;
        }
        sent += claimed.length;
      } catch (error) {
        console.error('send-sales-digest: batch send failed', error);
        await release();
        failed += claimed.length;
      }
    }

    return json({ sent, failed, subscribers: subscribers.length });
  } catch (error) {
    console.error('send-sales-digest error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
