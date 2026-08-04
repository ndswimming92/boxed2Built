import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { buildCaption, postToFacebook, postToInstagram, FacebookTokens } from '../_shared/socialPublish.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: dueItems, error: dueErr } = await admin
      .from('gallery_items')
      .select('id, type, src, title, description, alt, hashtags, eligible_for_social, social_scheduled_at')
      .not('social_scheduled_at', 'is', null)
      .lte('social_scheduled_at', new Date().toISOString());
    if (dueErr) throw new Error(dueErr.message);
    if (!dueItems || dueItems.length === 0) {
      return json({ processed: 0 });
    }

    let tokens: FacebookTokens | null = null;
    let tokensError: string | null = null;

    const { data: connection } = await admin
      .from('integration_connections')
      .select('vault_secret_name')
      .eq('provider', 'facebook')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!connection?.vault_secret_name) {
      tokensError = 'Facebook is not connected. Connect it under Admin → Connections first.';
    } else {
      const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
        p_name: connection.vault_secret_name,
      });
      if (secretErr || !secretJson) {
        tokensError = 'Could not load the stored Facebook credentials. Try reconnecting.';
      } else {
        tokens = JSON.parse(secretJson) as FacebookTokens;
      }
    }

    const results: { id: string; facebook_success: boolean; instagram_success: boolean }[] = [];

    for (const item of dueItems) {
      // Claim the row (clear the schedule) before posting so a slow run or an
      // overlapping cron tick can't process — and post — the same item twice.
      const { data: claimed } = await admin
        .from('gallery_items')
        .update({ social_scheduled_at: null })
        .eq('id', item.id)
        .eq('social_scheduled_at', item.social_scheduled_at)
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      try {
        if (item.type !== 'image') {
          await admin
            .from('gallery_items')
            .update({ facebook_post_error: 'Only images can be scheduled for social posting right now.' })
            .eq('id', item.id);
          results.push({ id: item.id, facebook_success: false, instagram_success: false });
          continue;
        }
        if (!item.eligible_for_social) {
          await admin
            .from('gallery_items')
            .update({ facebook_post_error: 'This item is marked website-gallery only and is not eligible for social posting.' })
            .eq('id', item.id);
          results.push({ id: item.id, facebook_success: false, instagram_success: false });
          continue;
        }
        if (!tokens) {
          await admin
            .from('gallery_items')
            .update({ facebook_post_error: tokensError, instagram_post_error: tokensError })
            .eq('id', item.id);
          results.push({ id: item.id, facebook_success: false, instagram_success: false });
          continue;
        }

        const caption = buildCaption(item.title, item.description, item.hashtags);
        const [facebookResult, instagramResult] = await Promise.all([
          postToFacebook(tokens, item.src, caption, item.alt),
          postToInstagram(tokens, item.src, caption, item.alt),
        ]);

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
          .eq('id', item.id);

        results.push({ id: item.id, facebook_success: facebookResult.success, instagram_success: instagramResult.success });
      } catch (itemError) {
        console.error(`run-scheduled-social-posts: failed to process item ${item.id}:`, itemError);
        const msg = itemError instanceof Error ? itemError.message : 'Unknown error while posting';
        await admin
          .from('gallery_items')
          .update({ facebook_post_error: msg, instagram_post_error: msg })
          .eq('id', item.id);
        results.push({ id: item.id, facebook_success: false, instagram_success: false });
      }
    }

    return json({ processed: results.length, results });
  } catch (error) {
    console.error('run-scheduled-social-posts error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
