import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');
const APP_URL = 'https://www.boxed2built.com';
const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const PROVIDER = 'facebook';
const CONNECTIONS_PAGE = `${APP_URL}/admin/connections`;
const OAUTH_SCOPES_FOR_RECORD = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'pages_read_user_content',
  'read_insights',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'instagram_manage_comments',
  'business_management',
];

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

function redirect(params: Record<string, string>): Response {
  const url = new URL(CONNECTIONS_PAGE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

async function exchangeCodeForUserToken(code: string, redirectUri: string): Promise<string> {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('client_id', FACEBOOK_APP_ID!);
  url.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || 'Failed to exchange code for a Facebook access token');
  return body.access_token as string;
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', FACEBOOK_APP_ID!);
  url.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || 'Failed to obtain a long-lived Facebook access token');
  return body.access_token as string;
}

async function fetchManagedPages(userToken: string): Promise<FacebookPage[]> {
  const url = new URL(`${GRAPH_URL}/me/accounts`);
  url.searchParams.set('access_token', userToken);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || 'Failed to list Facebook Pages');
  return (body?.data ?? []) as FacebookPage[];
}

async function fetchLinkedInstagramAccount(pageId: string, pageToken: string): Promise<{ id: string; username?: string } | null> {
  const url = new URL(`${GRAPH_URL}/${pageId}`);
  url.searchParams.set('fields', 'instagram_business_account{id,username}');
  url.searchParams.set('access_token', pageToken);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.instagram_business_account ?? null;
}

async function upsertConnection(
  admin: ReturnType<typeof createClient>,
  provider: string,
  row: Record<string, unknown>,
) {
  const { data: existing } = await admin
    .from('integration_connections')
    .select('id')
    .eq('provider', provider)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin.from('integration_connections').update(row).eq('id', existing.id);
  } else {
    await admin.from('integration_connections').insert({ provider, ...row });
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');

  if (oauthError) {
    return redirect({ connection_error: `Facebook sign-in was cancelled or denied (${oauthError}).` });
  }
  if (!code || !state) {
    return redirect({ connection_error: 'Facebook did not return the expected authorization code.' });
  }
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return redirect({ connection_error: 'Facebook/Instagram is not configured yet on the server.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: stateRow, error: stateErr } = await admin
      .from('oauth_states')
      .select('id, created_by, expires_at')
      .eq('state', state)
      .eq('provider', PROVIDER)
      .maybeSingle();

    if (stateErr || !stateRow) {
      return redirect({ connection_error: 'This connection link was invalid or already used. Please try connecting again.' });
    }
    await admin.from('oauth_states').delete().eq('id', stateRow.id);

    if (new Date(stateRow.expires_at) <= new Date()) {
      return redirect({ connection_error: 'This connection link expired. Please try connecting again.' });
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;
    const shortLivedToken = await exchangeCodeForUserToken(code, redirectUri);
    const longLivedUserToken = await exchangeForLongLivedToken(shortLivedToken);

    const pages = await fetchManagedPages(longLivedUserToken);
    if (pages.length === 0) {
      return redirect({ connection_error: 'No Facebook Pages were found for this account. Make sure you approved access to your business Page.' });
    }

    const page = pages[0];
    const instagram = await fetchLinkedInstagramAccount(page.id, page.access_token);

    const vaultSecretName = `fb_oauth_${crypto.randomUUID()}`;
    const { error: vaultErr } = await admin.rpc('store_vault_secret', {
      p_secret: JSON.stringify({
        page_access_token: page.access_token,
        page_id: page.id,
        page_name: page.name,
        ig_user_id: instagram?.id ?? null,
        ig_username: instagram?.username ?? null,
        long_lived_user_token: longLivedUserToken,
        obtained_at: new Date().toISOString(),
      }),
      p_name: vaultSecretName,
    });
    if (vaultErr) throw new Error(`Failed to securely store tokens: ${vaultErr.message}`);

    await upsertConnection(admin, 'facebook', {
      account_label: page.name,
      account_identifier: page.id,
      status: 'connected',
      scopes: OAUTH_SCOPES_FOR_RECORD,
      vault_secret_name: vaultSecretName,
      token_expires_at: null,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
      created_by: stateRow.created_by,
    });

    await upsertConnection(admin, 'instagram', {
      account_label: instagram?.username ?? null,
      account_identifier: instagram?.id ?? null,
      status: instagram ? 'connected' : 'error',
      scopes: OAUTH_SCOPES_FOR_RECORD,
      vault_secret_name: vaultSecretName,
      token_expires_at: null,
      last_synced_at: instagram ? new Date().toISOString() : null,
      sync_error: instagram ? null : `No Instagram Business account is linked to the Facebook Page "${page.name}". Link one in Meta Business Suite, then reconnect.`,
      created_by: stateRow.created_by,
    });

    return redirect({ connected: 'facebook' });
  } catch (error) {
    console.error('facebook-oauth-callback error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return redirect({ connection_error: msg });
  }
});
