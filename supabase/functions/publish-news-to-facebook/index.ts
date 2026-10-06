import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { postTextToFacebook, type FacebookTokens } from '../_shared/socialPublish.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
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
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    const body = await req.json().catch(() => ({}));
    const newsItemId = body?.news_item_id as string | undefined;
    if (!newsItemId) return json({ error: 'news_item_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: item, error: itemErr } = await admin
      .from('news_items')
      .select('id, organization_id, title, summary, source_name, source_url, status')
      .eq('id', newsItemId)
      .maybeSingle();
    if (itemErr || !item) return json({ error: 'News item not found' }, 404);

    // Only approved stories go out; a draft or rejected one was never cleared.
    if (item.status !== 'published') {
      return json({ error: 'Only published news items can be posted to Facebook.' }, 400);
    }
    if (!/^https?:\/\//i.test(item.source_url)) {
      return json({ error: 'This item has no valid source link to share.' }, 400);
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

    const message = `${item.title}\n\n${item.summary}\n\nSource: ${item.source_name}`;
    const result = await postTextToFacebook(tokens, message, item.source_url);

    // A failed retry must only record the error: an earlier successful post
    // still exists on the Page, and its id and date drive the "post again?"
    // confirmation. Upsert only writes the columns it is given.
    const record = result.success
      ? {
          post_id: result.post_id,
          posted_at: new Date().toISOString(),
          last_error: null,
        }
      : { last_error: result.error };
    const { error: saveErr } = await admin
      .from('news_facebook_posts')
      .upsert(
        {
          news_item_id: newsItemId,
          organization_id: item.organization_id,
          updated_at: new Date().toISOString(),
          ...record,
        },
        { onConflict: 'news_item_id' },
      );
    if (saveErr) {
      console.error('publish-news-to-facebook: failed to record the result', saveErr);
      if (result.success) {
        // The post is live but untracked, so the admin could post it twice.
        return json({
          facebook: result,
          tracking_error:
            'The story was posted to Facebook, but saving a record of it failed. Do not post it again; check the Page.',
        });
      }
    }

    return json({ facebook: result });
  } catch (error) {
    console.error('publish-news-to-facebook error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
