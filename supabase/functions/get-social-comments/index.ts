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
const RECENT_POSTS_LIMIT = 10;
const COMMENTS_PER_POST_LIMIT = 50;
const REPLIES_PER_COMMENT_LIMIT = 10;

interface FacebookTokens {
  page_access_token: string;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  ig_username: string | null;
}

interface SocialComment {
  id: string;
  platform: 'facebook' | 'instagram';
  post_id: string;
  post_permalink: string | null;
  author: string;
  message: string;
  created_time: string;
  replied: boolean;
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

function repliedByOwner(replies: { data?: { from?: { id?: string } }[] } | undefined, ownerId: string): boolean {
  return !!replies?.data?.some((reply) => reply?.from?.id === ownerId);
}

async function fetchFacebookComments(pageId: string, accessToken: string): Promise<{ comments: SocialComment[]; error: string | null }> {
  const { ok, body } = await graphGet(`/${pageId}/posts`, {
    fields: `id,permalink_url,comments.limit(${COMMENTS_PER_POST_LIMIT}){id,message,from,created_time,comments.limit(${REPLIES_PER_COMMENT_LIMIT}){from}}`,
    limit: String(RECENT_POSTS_LIMIT),
    access_token: accessToken,
  });
  if (!ok) return { comments: [], error: body?.error?.message || 'Failed to load Facebook comments' };

  const comments: SocialComment[] = [];
  for (const post of body?.data ?? []) {
    for (const comment of post?.comments?.data ?? []) {
      if (comment?.from?.id === pageId) continue; // skip the Page's own comments/replies
      comments.push({
        id: comment.id,
        platform: 'facebook',
        post_id: post.id,
        post_permalink: post.permalink_url ?? null,
        author: comment?.from?.name ?? 'Facebook user',
        message: comment.message ?? '',
        created_time: comment.created_time,
        replied: repliedByOwner(comment.comments, pageId),
      });
    }
  }
  return { comments, error: null };
}

async function fetchInstagramComments(igUserId: string, accessToken: string): Promise<{ comments: SocialComment[]; error: string | null }> {
  const { ok, body } = await graphGet(`/${igUserId}/media`, {
    fields: `id,permalink,comments.limit(${COMMENTS_PER_POST_LIMIT}){id,text,username,from,timestamp,replies.limit(${REPLIES_PER_COMMENT_LIMIT}){from}}`,
    limit: String(RECENT_POSTS_LIMIT),
    access_token: accessToken,
  });
  if (!ok) return { comments: [], error: body?.error?.message || 'Failed to load Instagram comments' };

  const comments: SocialComment[] = [];
  for (const media of body?.data ?? []) {
    for (const comment of media?.comments?.data ?? []) {
      if (comment?.from?.id === igUserId) continue; // skip the account's own comments/replies
      comments.push({
        id: comment.id,
        platform: 'instagram',
        post_id: media.id,
        post_permalink: media.permalink ?? null,
        author: comment?.username ?? comment?.from?.username ?? 'Instagram user',
        message: comment.text ?? '',
        created_time: comment.timestamp,
        replied: repliedByOwner(comment.replies, igUserId),
      });
    }
  }
  return { comments, error: null };
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

    const [facebookResult, instagramResult] = await Promise.all([
      fetchFacebookComments(tokens.page_id, tokens.page_access_token),
      tokens.ig_user_id
        ? fetchInstagramComments(tokens.ig_user_id, tokens.page_access_token)
        : Promise.resolve({ comments: [] as SocialComment[], error: null }),
    ]);

    const comments = [...facebookResult.comments, ...instagramResult.comments].sort(
      (a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
    );
    const unrepliedCount = comments.filter((c) => !c.replied).length;

    return json({
      comments,
      unreplied_count: unrepliedCount,
      facebook_error: facebookResult.error,
      instagram_error: instagramResult.error,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-social-comments error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
