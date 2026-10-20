import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderWelcomeEmail } from '../_shared/salesDigestEmail.ts';
import { UUID_PATTERN, unsubscribeHeaders, unsubscribePageUrl } from '../_shared/salesSubscribers.ts';

/**
 * Public sign-up and opt-out for the daily sales email.
 *
 *   POST { action: 'subscribe', name, email }   from the News page form
 *   POST { action: 'unsubscribe', token }       from the unsubscribe page
 *   POST ?token=...  (List-Unsubscribe=One-Click) from a mail app's own button
 *
 * Runs with verify_jwt = false (see supabase/config.toml): visitors have no
 * session. The table has no anonymous policies at all, so this function, using
 * the service role, is the only way in.
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

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const EMAIL_PATTERN = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/;
const NAME_MAX = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Admin = ReturnType<typeof createClient>;

/**
 * Counts this connection's recent attempts. Fails closed: if the count cannot
 * be read, the sign-up is refused rather than let through unlimited, because
 * every sign-up sends an email to an address the visitor chose.
 */
async function withinRateLimit(admin: Admin, ipKey: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from('sale_subscribe_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_key', ipKey)
    .gte('created_at', windowStart);
  if (error) {
    console.error('sales-subscription: rate limit check failed', error.message);
    return false;
  }
  return (count ?? 0) < RATE_LIMIT_MAX;
}

async function recordAttempt(admin: Admin, ipKey: string): Promise<void> {
  const { error } = await admin.from('sale_subscribe_attempts').insert({ ip_key: ipKey.slice(0, 100) });
  if (error) console.error('sales-subscription: could not record attempt', error.message);

  // Housekeeping: nothing older than the window is ever read again.
  await admin
    .from('sale_subscribe_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
}

async function unsubscribe(admin: Admin, token: string): Promise<Response> {
  if (!UUID_PATTERN.test(token)) return json({ error: 'This unsubscribe link is not valid.' }, 400);

  const { error } = await admin
    .from('sale_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .eq('status', 'active');

  if (error) {
    console.error('sales-subscription: unsubscribe failed', error.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  // The same answer whether or not the row was still active, so the link can
  // be clicked twice and a stale link still reads as "you are unsubscribed".
  return json({ success: true });
}

async function subscribe(
  req: Request,
  admin: Admin,
  body: Record<string, unknown>,
): Promise<Response> {
  // A field real visitors never see. Bots fill it in; they get a success and
  // nothing is stored or sent.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json({ success: true });

  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!name) return json({ error: 'Please enter your name.' }, 400);
  if (name.length > NAME_MAX) return json({ error: 'That name is too long.' }, 400);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  const ipKey = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown')
    .split(',')[0]
    .trim();

  if (!(await withinRateLimit(admin, ipKey))) {
    return json({ error: 'Too many sign-ups from this connection. Please try again later.' }, 429);
  }
  await recordAttempt(admin, ipKey);

  const { data: business } = await admin
    .from('business_info')
    .select('organization_id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business?.organization_id) {
    console.error('sales-subscription: no active business_info row to attach the subscriber to');
    return json({ error: 'Sign-up is unavailable right now. Please try again later.' }, 503);
  }

  const normalized = email.toLowerCase();
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await admin
    .from('sale_subscribers')
    .select('id, status, unsubscribe_token')
    .eq('organization_id', business.organization_id)
    .eq('email_normalized', normalized)
    .maybeSingle();

  if (lookupError) {
    console.error('sales-subscription: lookup failed', lookupError.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  let token: string;

  if (existing && existing.status === 'active') {
    // Already on the list. Say success and send nothing: replying differently
    // would let anyone probe who is subscribed, and a second welcome email
    // would let anyone make us mail a stranger repeatedly.
    return json({ success: true });
  }

  if (existing) {
    // Opted out earlier and signing up again: reactivate the same row. The
    // "sent through" mark restarts so they do not get everything they missed.
    const { error } = await admin
      .from('sale_subscribers')
      .update({ name, status: 'active', unsubscribed_at: null, subscribed_at: now, last_digest_at: now })
      .eq('id', existing.id);
    if (error) {
      console.error('sales-subscription: resubscribe failed', error.message);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
    token = existing.unsubscribe_token;
  } else {
    const { data: created, error } = await admin
      .from('sale_subscribers')
      .insert({ organization_id: business.organization_id, name, email, last_digest_at: now })
      .select('unsubscribe_token')
      .single();

    if (error) {
      // Two sign-ups racing for the same address: the loser is already covered.
      if (error.code === '23505') return json({ success: true });
      console.error('sales-subscription: insert failed', error.message);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
    token = created.unsubscribe_token;
  }

  if (RESEND_API_KEY) {
    const welcome = renderWelcomeEmail({
      name,
      siteUrl: SITE_URL,
      unsubscribeUrl: unsubscribePageUrl(SITE_URL, token),
    });

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Boxed2Built <${FROM_EMAIL}>`,
          to: [email],
          subject: welcome.subject,
          html: welcome.html,
          text: welcome.text,
          reply_to: REPLY_TO_EMAIL,
          headers: unsubscribeHeaders(SUPABASE_URL, SITE_URL, token),
        }),
      });
      if (!response.ok) {
        console.error('sales-subscription: Resend rejected the welcome email', response.status, await response.text());
      }
    } catch (error) {
      console.error('sales-subscription: welcome email failed', error);
    }
  } else {
    console.error('sales-subscription: RESEND_API_KEY missing, welcome email skipped');
  }

  return json({ success: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // A mail app's one-click unsubscribe: POST to the URL in List-Unsubscribe,
    // with the token in the query string and a form body.
    const queryToken = new URL(req.url).searchParams.get('token');
    if (queryToken) return await unsubscribe(admin, queryToken);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);

    if (body.action === 'subscribe') return await subscribe(req, admin, body);
    if (body.action === 'unsubscribe') {
      return await unsubscribe(admin, typeof body.token === 'string' ? body.token : '');
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('sales-subscription error:', error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
