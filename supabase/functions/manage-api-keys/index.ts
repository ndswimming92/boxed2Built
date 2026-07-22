import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const KEY_PREFIX = 'b2b_live_';

const ALLOWED_SCOPES = [
  'inquiries:read',
  'inquiries:write',
  'jobs:read',
  'invoices:read',
  'clients:read',
];

interface CreatePayload {
  action: 'create';
  name: string;
  scopes: string[];
  expires_in_days?: number | null;
  rate_limit_per_minute?: number | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Authenticate the caller as a platform admin
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const appMeta = (userData.user.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.is_platform_admin !== true && appMeta.is_platform_admin !== 'true') {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = (await req.json()) as CreatePayload;
    if (body.action !== 'create') return json({ error: 'Unsupported action' }, 400);

    const name = (body.name || '').trim();
    if (!name) return json({ error: 'name is required' }, 400);
    if (name.length > 100) return json({ error: 'name must be 100 characters or less' }, 400);

    const scopes = Array.isArray(body.scopes) ? body.scopes : [];
    if (scopes.length === 0) return json({ error: 'At least one scope is required' }, 400);
    const invalid = scopes.filter((s) => !ALLOWED_SCOPES.includes(s));
    if (invalid.length > 0) {
      return json({ error: `Invalid scopes: ${invalid.join(', ')}` }, 400);
    }

    let expiresAt: string | null = null;
    if (body.expires_in_days != null) {
      const days = Number(body.expires_in_days);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) {
        return json({ error: 'expires_in_days must be between 1 and 3650' }, 400);
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    let rateLimit = 60;
    if (body.rate_limit_per_minute != null) {
      const rl = Number(body.rate_limit_per_minute);
      if (!Number.isInteger(rl) || rl < 1 || rl > 1000) {
        return json({ error: 'rate_limit_per_minute must be between 1 and 1000' }, 400);
      }
      rateLimit = rl;
    }

    // Generate the key server-side; the full key is returned exactly once and
    // only its SHA-256 hash is stored.
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const fullKey = `${KEY_PREFIX}${toHex(randomBytes)}`;
    const keyHash = await sha256Hex(fullKey);
    const keyPrefix = fullKey.slice(0, KEY_PREFIX.length + 6);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: record, error } = await admin
      .from('api_keys')
      .insert({
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        rate_limit_per_minute: rateLimit,
        expires_at: expiresAt,
        created_by: userData.user.id,
      })
      .select('id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at')
      .single();

    if (error) return json({ error: error.message }, 400);

    return json({ api_key: fullKey, record });
  } catch (error) {
    console.error('manage-api-keys error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
