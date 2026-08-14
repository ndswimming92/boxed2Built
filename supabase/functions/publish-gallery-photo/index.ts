import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { buildCaption, postToFacebook, postToInstagram, FacebookTokens } from '../_shared/socialPublish.ts';
import { annotateInstagramError, prepareInstagramImage } from '../_shared/instagramImage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const galleryItemId = body?.gallery_item_id as string | undefined;
    if (!galleryItemId) return json({ error: 'gallery_item_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: item, error: itemErr } = await admin
      .from('gallery_items')
      .select('id, type, src, title, description, alt, hashtags, eligible_for_social')
      .eq('id', galleryItemId)
      .maybeSingle();
    if (itemErr || !item) return json({ error: 'Gallery item not found' }, 404);
    if (item.type !== 'image') {
      return json({ error: 'Only images can be posted to social right now.' }, 400);
    }
    if (!item.eligible_for_social) {
      return json({ error: 'This item is marked website-gallery only and is not eligible for social posting.' }, 400);
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

    const caption = buildCaption(item.title, item.description, item.hashtags);

    // Instagram rejects anything that isn't a JPEG inside its aspect-ratio
    // window, so it gets a reformatted copy when the original wouldn't pass.
    // Facebook is happy with the original file either way.
    const instagramImage = await prepareInstagramImage(admin, item.id, item.src);
    if (instagramImage.note) console.log(`publish-gallery-photo ${item.id}: ${instagramImage.note}`);
    if (instagramImage.error) console.error(`publish-gallery-photo ${item.id}: ${instagramImage.error}`);

    const [facebookResult, rawInstagramResult] = await Promise.all([
      postToFacebook(tokens, item.src, caption, item.alt),
      postToInstagram(tokens, instagramImage.url, caption, item.alt),
    ]);
    const instagramResult = annotateInstagramError(instagramImage, rawInstagramResult);

    await admin
      .from('gallery_items')
      .update({
        facebook_post_id: facebookResult.success ? facebookResult.post_id : null,
        facebook_posted_at: facebookResult.success ? new Date().toISOString() : null,
        facebook_post_error: facebookResult.success ? null : facebookResult.error,
        facebook_post_removed_at: null,
        facebook_post_removed_reason: null,
        instagram_post_id: instagramResult.success ? instagramResult.post_id : null,
        instagram_posted_at: instagramResult.success ? new Date().toISOString() : null,
        instagram_post_error: instagramResult.success ? null : instagramResult.error,
        instagram_post_removed_at: null,
        instagram_post_removed_reason: null,
      })
      .eq('id', galleryItemId);

    return json({
      facebook: facebookResult,
      instagram: instagramResult,
      instagram_reformatted: instagramImage.reformatted,
      instagram_reformat_note: instagramImage.note ?? null,
    });
  } catch (error) {
    console.error('publish-gallery-photo error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
