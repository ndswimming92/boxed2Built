import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { checkPostRemoved, FacebookTokens } from '../_shared/socialPublish.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MAX_ITEMS_PER_RUN = 40;

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

    const body = await req.json().catch(() => ({}));
    const requestedIds = Array.isArray(body?.gallery_item_ids) ? (body.gallery_item_ids as string[]) : null;

    let query = admin
      .from('gallery_items')
      .select('id, facebook_post_id, facebook_post_removed_at, instagram_post_id, instagram_post_removed_at')
      .or('facebook_post_id.not.is.null,instagram_post_id.not.is.null')
      .order('facebook_posted_at', { ascending: false, nullsFirst: false });

    if (requestedIds && requestedIds.length > 0) {
      query = query.in('id', requestedIds);
    } else {
      query = query
        .or('facebook_post_removed_at.is.null,instagram_post_removed_at.is.null')
        .limit(MAX_ITEMS_PER_RUN);
    }

    const { data: items, error: itemsErr } = await query;
    if (itemsErr) throw new Error(itemsErr.message);

    const removedFacebook: string[] = [];
    const removedInstagram: string[] = [];

    for (const item of items ?? []) {
      const updates: Record<string, unknown> = {};

      if (item.facebook_post_id && !item.facebook_post_removed_at) {
        const result = await checkPostRemoved(item.facebook_post_id, tokens.page_access_token);
        if (result.removed) {
          updates.facebook_post_removed_at = new Date().toISOString();
          updates.facebook_post_removed_reason = result.reason;
          removedFacebook.push(item.id);
        }
      }

      if (item.instagram_post_id && !item.instagram_post_removed_at) {
        const result = await checkPostRemoved(item.instagram_post_id, tokens.page_access_token);
        if (result.removed) {
          updates.instagram_post_removed_at = new Date().toISOString();
          updates.instagram_post_removed_reason = result.reason;
          removedInstagram.push(item.id);
        }
      }

      if (Object.keys(updates).length > 0) {
        await admin.from('gallery_items').update(updates).eq('id', item.id);
      }
    }

    return json({
      checked: items?.length ?? 0,
      facebook_removed: removedFacebook,
      instagram_removed: removedInstagram,
    });
  } catch (error) {
    console.error('check-social-post-status error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
