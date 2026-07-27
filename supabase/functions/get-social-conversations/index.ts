import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const CONVERSATIONS_LIMIT = 25;

interface FacebookTokens {
  page_access_token: string;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  ig_username: string | null;
}

interface SocialConversation {
  id: string;
  platform: 'facebook' | 'instagram';
  participant_id: string;
  participant_name: string;
  last_message: string;
  last_message_time: string;
  needs_reply: boolean;
  archived: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

async function fetchConversations(
  pageId: string,
  accessToken: string,
  platform: 'facebook' | 'instagram',
  ownerId: string,
  archivedIds: Set<string>
): Promise<{ conversations: SocialConversation[]; error: string | null }> {
  const { ok, body } = await graphGet(`/${pageId}/conversations`, {
    platform: platform === 'facebook' ? 'messenger' : 'instagram',
    fields: 'participants,updated_time,messages.limit(1){message,from,created_time}',
    limit: String(CONVERSATIONS_LIMIT),
    access_token: accessToken,
  });
  if (!ok) {
    return {
      conversations: [],
      error: body?.error?.message || `Failed to load ${platform === 'facebook' ? 'Messenger' : 'Instagram DM'} conversations`,
    };
  }

  const conversations: SocialConversation[] = [];
  for (const convo of body?.data ?? []) {
    const lastMessage = convo?.messages?.data?.[0];
    if (!lastMessage) continue;

    const participant = (convo?.participants?.data ?? []).find((p: { id?: string }) => p?.id !== ownerId);
    if (!participant) continue;

    conversations.push({
      id: convo.id,
      platform,
      participant_id: participant.id,
      participant_name: participant.name ?? (platform === 'facebook' ? 'Facebook user' : 'Instagram user'),
      last_message: lastMessage.message ?? '',
      last_message_time: lastMessage.created_time ?? convo.updated_time,
      needs_reply: lastMessage?.from?.id !== ownerId,
      archived: archivedIds.has(convo.id),
    });
  }
  return { conversations, error: null };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
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

    const { data: archivedRows } = await admin
      .from('social_conversation_archive')
      .select('conversation_id');
    const archivedIds = new Set((archivedRows ?? []).map((row) => row.conversation_id as string));

    const [facebookResult, instagramResult] = await Promise.all([
      fetchConversations(tokens.page_id, tokens.page_access_token, 'facebook', tokens.page_id, archivedIds),
      tokens.ig_user_id
        ? fetchConversations(tokens.page_id, tokens.page_access_token, 'instagram', tokens.ig_user_id, archivedIds)
        : Promise.resolve({ conversations: [] as SocialConversation[], error: null }),
    ]);

    const conversations = [...facebookResult.conversations, ...instagramResult.conversations].sort(
      (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    );
    const needsReplyCount = conversations.filter((c) => c.needs_reply && !c.archived).length;

    return json({
      conversations,
      needs_reply_count: needsReplyCount,
      facebook_error: facebookResult.error,
      instagram_error: instagramResult.error,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-social-conversations error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
