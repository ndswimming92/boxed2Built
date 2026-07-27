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
const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_MESSAGE_LENGTH = 2000;

interface FacebookTokens {
  page_access_token: string;
  page_id: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

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
    const recipientId = body?.recipient_id as string | undefined;
    const message = (body?.message as string | undefined)?.trim();

    if (!recipientId) return json({ error: 'recipient_id is required' }, 400);
    if (!message) return json({ error: 'message is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connErr } = await admin
      .from('integration_connections')
      .select('vault_secret_name')
      .eq('provider', 'facebook')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (connErr || !connection?.vault_secret_name) {
      return json({ error: 'Facebook is not connected. Connect it under Admin → Connections first.' }, 400);
    }

    const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
      p_name: connection.vault_secret_name,
    });
    if (secretErr || !secretJson) {
      return json({ error: 'Could not load the stored Facebook credentials. Try reconnecting.' }, 500);
    }
    const tokens = JSON.parse(secretJson) as FacebookTokens;

    const res = await fetch(`${GRAPH_URL}/${tokens.page_id}/messages`, {
      method: 'POST',
      body: new URLSearchParams({
        recipient: JSON.stringify({ id: recipientId }),
        message: JSON.stringify({ text: message.slice(0, MAX_MESSAGE_LENGTH) }),
        messaging_type: 'RESPONSE',
        access_token: tokens.page_access_token,
      }),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Meta rejects a RESPONSE-type send once the customer's last message is
      // more than 24 hours old — surface that plainly instead of a raw Graph error.
      const rawMessage = resBody?.error?.message || '';
      const outsideWindow = /window|24.?hour/i.test(rawMessage);
      return json({
        error: outsideWindow
          ? 'This conversation is outside the 24-hour reply window Meta allows for standard replies. The customer needs to message again before a reply can be sent.'
          : rawMessage || 'Meta rejected the message',
      }, 502);
    }

    return json({ success: true, message_id: resBody.message_id });
  } catch (error) {
    console.error('send-social-message error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
