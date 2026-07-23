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
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

const YOUTUBE_CATEGORY_ID = '26'; // Howto & Style
const REFRESH_BUFFER_MS = 60_000;
const PRIVACY_STATUSES = ['private', 'unlisted', 'public'];

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at?: string;
  obtained_at: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error_description || body?.error || 'Failed to refresh the Google access token');
  }
  return body;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: 'YouTube upload is not configured yet on the server.' }, 501);
    }

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

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const privacyStatus = PRIVACY_STATUSES.includes(body?.privacy_status) ? body.privacy_status : 'private';
    const contentType = typeof body?.content_type === 'string' ? body.content_type : '';
    const contentLength = Number(body?.content_length);

    if (!title) return json({ error: 'title is required' }, 400);
    if (!contentType.startsWith('video/')) return json({ error: 'content_type must be a video mime type' }, 400);
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return json({ error: 'content_length must be a positive number' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connErr } = await admin
      .from('integration_connections')
      .select('vault_secret_name')
      .eq('provider', 'youtube')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (connErr || !connection?.vault_secret_name) {
      return json({ error: 'YouTube is not connected. Connect it under Admin → Connections first.' }, 400);
    }

    const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
      p_name: connection.vault_secret_name,
    });
    if (secretErr || !secretJson) {
      return json({ error: 'Could not load the stored Google credentials. Try reconnecting.' }, 500);
    }
    const tokens = JSON.parse(secretJson) as GoogleTokens;

    let accessToken = tokens.access_token;
    const isStale = !tokens.expires_at || new Date(tokens.expires_at).getTime() - REFRESH_BUFFER_MS <= Date.now();
    if (isStale) {
      if (!tokens.refresh_token) {
        return json({ error: 'The stored Google credentials have expired and cannot be refreshed. Reconnect under Admin → Connections.' }, 401);
      }
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      accessToken = refreshed.access_token;
      const updated: GoogleTokens = {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        obtained_at: new Date().toISOString(),
      };
      const { error: updateErr } = await admin.rpc('update_vault_secret', {
        p_name: connection.vault_secret_name,
        p_secret: JSON.stringify(updated),
      });
      if (updateErr) console.error('youtube-upload-start failed to persist refreshed token:', updateErr);
    }

    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(contentLength),
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: YOUTUBE_CATEGORY_ID },
        status: { privacyStatus },
      }),
    });

    if (!initRes.ok) {
      const errBody = await initRes.json().catch(() => ({}));
      return json({ error: errBody?.error?.message || 'YouTube rejected the upload request' }, initRes.status);
    }

    const sessionUri = initRes.headers.get('Location');
    if (!sessionUri) {
      return json({ error: 'YouTube did not return an upload session URL' }, 500);
    }

    return json({ session_uri: sessionUri });
  } catch (error) {
    console.error('youtube-upload-start error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
