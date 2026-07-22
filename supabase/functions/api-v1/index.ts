import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const KEY_PREFIX = 'b2b_live_';
const MAX_PAGE_SIZE = 100;
const LAST_USED_THROTTLE_MS = 60_000;

// Columns exposed through the v1 API. Explicit lists keep the API contract
// stable and keep internal fields (payment tokens, internal notes) private.
const INVOICE_COLUMNS = [
  'id', 'invoice_number', 'invoice_type', 'inquiry_id', 'job_id',
  'client_name', 'client_email', 'client_phone', 'client_address',
  'invoice_date', 'due_date', 'payment_terms', 'status',
  'subtotal', 'tax_rate', 'tax_amount', 'total_amount', 'amount_paid', 'amount_due',
  'notes', 'sent_at', 'paid_at', 'created_at', 'updated_at',
].join(', ');

const CLIENT_COLUMNS = [
  'id', 'name', 'email', 'phone', 'address',
  'client_status', 'client_value_tier',
  'marketing_email_opt_in', 'marketing_sms_opt_in',
  'first_contact_date', 'last_contact_date', 'last_job_date',
  'total_revenue', 'job_count', 'average_job_value',
  'source', 'tags', 'created_at', 'updated_at',
].join(', ');

interface ApiKeyRecord {
  id: string;
  name: string;
  scopes: string[];
  rate_limit_per_minute: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parsePagination(url: URL): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '25', 10) || 25, 1),
    MAX_PAGE_SIZE,
  );
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  return { limit, offset };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listOrGetById(
  admin: SupabaseClient,
  table: string,
  columns: string,
  id: string | null,
  url: URL,
  // deno-lint-ignore no-explicit-any
  filters?: (q: any) => any,
): Promise<Response> {
  if (id) {
    if (!UUID_RE.test(id)) return json({ error: 'Invalid id' }, 400);
    const { data, error } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'Not found' }, 404);
    return json({ data });
  }

  const { limit, offset } = parsePagination(url);
  let q = admin
    .from(table)
    .select(columns, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (filters) q = filters(q);
  const { data, error, count } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
}

async function createInquiry(admin: SupabaseClient, req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  const clientEmail = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  const furnitureType = typeof body.furniture_type === 'string' ? body.furniture_type.trim() : '';
  const pieces = Number(body.pieces);

  if (!clientName) return json({ error: 'client_name is required' }, 400);
  if (!clientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    return json({ error: 'A valid client_email is required' }, 400);
  }
  if (!furnitureType) return json({ error: 'furniture_type is required' }, 400);
  if (!Number.isInteger(pieces) || pieces < 1) {
    return json({ error: 'pieces must be a positive integer' }, 400);
  }

  const { data: business, error: bizErr } = await admin
    .from('business_info')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (bizErr || !business) return json({ error: 'Business configuration not found' }, 500);

  const optionalText = (field: string, max = 2000): string | null => {
    const v = body[field];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  };

  const { data, error } = await admin
    .from('form_inquiries')
    .insert({
      business_id: business.id,
      client_name: clientName.slice(0, 200),
      client_email: clientEmail.slice(0, 320),
      client_phone: optionalText('client_phone', 30),
      furniture_type: furnitureType.slice(0, 200),
      pieces,
      preferred_date: optionalText('preferred_date', 10),
      preferred_time_slot: optionalText('preferred_time_slot', 100),
      notes: optionalText('notes'),
      user_city: optionalText('user_city', 100),
      referral_source: optionalText('referral_source', 200),
      utm_source: optionalText('utm_source', 200),
      utm_medium: optionalText('utm_medium', 200),
      utm_campaign: optionalText('utm_campaign', 200),
      source: 'api',
    })
    .select('*')
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data }, 201);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  // Path arrives as /api-v1/<resource>[/<id>]
  const segments = url.pathname.replace(/^\/api-v1\/?/, '').split('/').filter(Boolean);
  const resource = segments[0] || '';
  const resourceId = segments[1] || null;
  const routeLabel = `${req.method} /${segments.join('/')}`;

  // --- Authenticate the API key ---
  const presented =
    req.headers.get('X-Api-Key') ||
    (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

  if (!presented || !presented.startsWith(KEY_PREFIX)) {
    return json({ error: 'Missing or malformed API key' }, 401);
  }

  const keyHash = await sha256Hex(presented);
  const { data: key, error: keyErr } = await admin
    .from('api_keys')
    .select('id, name, scopes, rate_limit_per_minute, expires_at, revoked_at, last_used_at, created_at')
    .eq('key_hash', keyHash)
    .maybeSingle<ApiKeyRecord>();

  if (keyErr || !key) return json({ error: 'Invalid API key' }, 401);
  if (key.revoked_at) return json({ error: 'API key has been revoked' }, 401);
  if (key.expires_at && new Date(key.expires_at) <= new Date()) {
    return json({ error: 'API key has expired' }, 401);
  }

  const logRequest = async (status: number, error?: string) => {
    try {
      await admin.from('api_request_logs').insert({
        api_key_id: key.id,
        method: req.method,
        path: `/${segments.join('/')}` || '/',
        status_code: status,
        error: error ?? null,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        user_agent: req.headers.get('user-agent'),
      });
    } catch (e) {
      console.error('api-v1 failed to write request log:', e);
    }
  };

  const respond = async (res: Response): Promise<Response> => {
    let errMsg: string | undefined;
    if (res.status >= 400) {
      try {
        errMsg = ((await res.clone().json()) as { error?: string }).error;
      } catch {
        // non-JSON error body; log without a message
      }
    }
    await logRequest(res.status, errMsg);
    return res;
  };

  const requireScope = (scope: string): Response | null => {
    if (key.scopes.includes(scope)) return null;
    return json({ error: `API key is missing required scope: ${scope}` }, 403);
  };

  try {
    // --- Rate limit (rolling 60s window over the request log) ---
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await admin
      .from('api_request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', key.id)
      .gte('created_at', windowStart);

    if ((recentCount ?? 0) >= key.rate_limit_per_minute) {
      return respond(json({ error: 'Rate limit exceeded. Try again shortly.' }, 429));
    }

    // Throttled last_used_at bump
    if (!key.last_used_at || Date.now() - new Date(key.last_used_at).getTime() > LAST_USED_THROTTLE_MS) {
      admin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id)
        .then(({ error }) => {
          if (error) console.error('api-v1 failed to update last_used_at:', error);
        });
    }

    // --- Routes ---
    if (resource === 'me' && req.method === 'GET') {
      return respond(json({
        data: {
          key_id: key.id,
          name: key.name,
          scopes: key.scopes,
          rate_limit_per_minute: key.rate_limit_per_minute,
          expires_at: key.expires_at,
          created_at: key.created_at,
        },
      }));
    }

    if (resource === 'inquiries') {
      if (req.method === 'GET') {
        const denied = requireScope('inquiries:read');
        if (denied) return respond(denied);
        const status = url.searchParams.get('status');
        return respond(await listOrGetById(admin, 'form_inquiries', '*', resourceId, url,
          (q) => (status ? q.eq('status', status) : q)));
      }
      if (req.method === 'POST' && !resourceId) {
        const denied = requireScope('inquiries:write');
        if (denied) return respond(denied);
        return respond(await createInquiry(admin, req));
      }
      return respond(json({ error: 'Method not allowed' }, 405));
    }

    if (resource === 'jobs' && req.method === 'GET') {
      const denied = requireScope('jobs:read');
      if (denied) return respond(denied);
      return respond(await listOrGetById(admin, 'jobs', '*', resourceId, url,
        (q) => q.eq('is_active', true)));
    }

    if (resource === 'invoices' && req.method === 'GET') {
      const denied = requireScope('invoices:read');
      if (denied) return respond(denied);
      const status = url.searchParams.get('status');
      return respond(await listOrGetById(admin, 'invoices', INVOICE_COLUMNS, resourceId, url,
        (q) => (status ? q.eq('status', status) : q)));
    }

    if (resource === 'clients' && req.method === 'GET') {
      const denied = requireScope('clients:read');
      if (denied) return respond(denied);
      return respond(await listOrGetById(admin, 'clients', CLIENT_COLUMNS, resourceId, url));
    }

    return respond(json({ error: `Unknown endpoint: ${routeLabel}` }, 404));
  } catch (error) {
    console.error('api-v1 error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return respond(json({ error: msg }, 500));
  }
});
