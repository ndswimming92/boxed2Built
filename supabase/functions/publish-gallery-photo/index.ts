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
const MAX_CAPTION_LENGTH = 2000;

interface FacebookTokens {
  page_access_token: string;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  ig_username: string | null;
}

interface PlatformResult {
  success: boolean;
  post_id?: string;
  error?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildCaption(title: string, description?: string | null): string {
  const caption = description ? `${title}\n\n${description}` : title;
  return caption.slice(0, MAX_CAPTION_LENGTH);
}

async function postToFacebook(tokens: FacebookTokens, imageUrl: string, caption: string): Promise<PlatformResult> {
  try {
    const res = await fetch(`${GRAPH_URL}/${tokens.page_id}/photos`, {
      method: 'POST',
      body: new URLSearchParams({
        url: imageUrl,
        caption,
        access_token: tokens.page_access_token,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Facebook rejected the post');
    return { success: true, post_id: body.post_id ?? body.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Facebook error' };
  }
}

async function postToInstagram(tokens: FacebookTokens, imageUrl: string, caption: string): Promise<PlatformResult> {
  if (!tokens.ig_user_id) {
    return { success: false, error: 'No Instagram Business account is linked to the connected Facebook Page.' };
  }
  try {
    const createRes = await fetch(`${GRAPH_URL}/${tokens.ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: tokens.page_access_token,
      }),
    });
    const createBody = await createRes.json();
    if (!createRes.ok) throw new Error(createBody?.error?.message || 'Instagram rejected the media container');
    const creationId = createBody.id as string;

    const publishRes = await fetch(`${GRAPH_URL}/${tokens.ig_user_id}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: tokens.page_access_token,
      }),
    });
    const publishBody = await publishRes.json();
    if (!publishRes.ok) throw new Error(publishBody?.error?.message || 'Instagram rejected publishing the post');
    return { success: true, post_id: publishBody.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Instagram error' };
  }
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
    const galleryItemId = body?.gallery_item_id as string | undefined;
    if (!galleryItemId) return json({ error: 'gallery_item_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: item, error: itemErr } = await admin
      .from('gallery_items')
      .select('id, type, src, title, description')
      .eq('id', galleryItemId)
      .maybeSingle();
    if (itemErr || !item) return json({ error: 'Gallery item not found' }, 404);
    if (item.type !== 'image') {
      return json({ error: 'Only images can be posted to social right now.' }, 400);
    }

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

    const caption = buildCaption(item.title, item.description);
    const [facebookResult, instagramResult] = await Promise.all([
      postToFacebook(tokens, item.src, caption),
      postToInstagram(tokens, item.src, caption),
    ]);

    await admin
      .from('gallery_items')
      .update({
        facebook_post_id: facebookResult.success ? facebookResult.post_id : null,
        facebook_posted_at: facebookResult.success ? new Date().toISOString() : null,
        facebook_post_error: facebookResult.success ? null : facebookResult.error,
        instagram_post_id: instagramResult.success ? instagramResult.post_id : null,
        instagram_posted_at: instagramResult.success ? new Date().toISOString() : null,
        instagram_post_error: instagramResult.success ? null : instagramResult.error,
      })
      .eq('id', galleryItemId);

    return json({ facebook: facebookResult, instagram: instagramResult });
  } catch (error) {
    console.error('publish-gallery-photo error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
