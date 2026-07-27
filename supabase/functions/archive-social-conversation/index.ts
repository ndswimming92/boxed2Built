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
    const conversationId = body?.conversation_id as string | undefined;
    const platform = body?.platform as 'facebook' | 'instagram' | undefined;
    const archived = body?.archived as boolean | undefined;

    if (!conversationId) return json({ error: 'conversation_id is required' }, 400);
    if (platform !== 'facebook' && platform !== 'instagram') {
      return json({ error: 'platform must be "facebook" or "instagram"' }, 400);
    }
    if (typeof archived !== 'boolean') return json({ error: 'archived must be a boolean' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (archived) {
      const { error } = await admin
        .from('social_conversation_archive')
        .upsert(
          { conversation_id: conversationId, platform, archived_by: userData.user.id },
          { onConflict: 'conversation_id' }
        );
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await admin
        .from('social_conversation_archive')
        .delete()
        .eq('conversation_id', conversationId);
      if (error) return json({ error: error.message }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error('archive-social-conversation error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
