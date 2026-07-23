import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const APP_URL = 'https://www.boxed2built.com';

const PROVIDER = 'google_business';
const CONNECTIONS_PAGE = `${APP_URL}/admin/connections`;

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleAccount {
  name: string;
  accountName?: string;
}

function redirect(params: Record<string, string>): Response {
  const url = new URL(CONNECTIONS_PAGE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error_description || body?.error || 'Failed to exchange code for tokens');
  }
  return body as GoogleTokenResponse;
}

async function fetchPrimaryAccount(accessToken: string): Promise<GoogleAccount | null> {
  const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const accounts = (body?.accounts ?? []) as GoogleAccount[];
  return accounts[0] ?? null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return redirect({ connection_error: `Google sign-in was cancelled or denied (${oauthError}).` });
  }
  if (!code || !state) {
    return redirect({ connection_error: 'Google did not return the expected authorization code.' });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return redirect({ connection_error: 'Google Business Profile is not configured yet on the server.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Validate and consume the one-time state token
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

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-business-oauth-callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Best-effort: fetch a display name for the connected account. This call
    // requires Google to have already approved Basic API Access for this
    // project, which can lag behind the OAuth consent itself — treat failure
    // here as informational, not fatal to the connection.
    let account: GoogleAccount | null = null;
    let syncError: string | null = null;
    try {
      account = await fetchPrimaryAccount(tokens.access_token);
      if (!account) {
        syncError = 'Connected, but no Business Profile account was returned yet. This usually means Google Business Profile API access is still pending approval.';
      }
    } catch {
      syncError = 'Connected, but could not load account details yet — Google Business Profile API access may still be pending approval.';
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const vaultSecretName = `gbp_oauth_${crypto.randomUUID()}`;
    const { error: vaultErr } = await admin.rpc('store_vault_secret', {
      p_secret: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_type: tokens.token_type,
        expires_at: tokenExpiresAt,
        obtained_at: new Date().toISOString(),
      }),
      p_name: vaultSecretName,
    });
    if (vaultErr) throw new Error(`Failed to securely store tokens: ${vaultErr.message}`);

    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
    const youtubeGranted = grantedScopes.includes('https://www.googleapis.com/auth/youtube.upload');

    const upsertConnection = async (provider: string, row: Record<string, unknown>) => {
      const { data: existing } = await admin
        .from('integration_connections')
        .select('id')
        .eq('provider', provider)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await admin
          .from('integration_connections')
          .update(row)
          .eq('id', existing.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await admin.from('integration_connections').insert({ provider, ...row });
        if (insertErr) throw new Error(insertErr.message);
      }
    };

    await upsertConnection(PROVIDER, {
      account_label: account?.accountName ?? null,
      account_identifier: account?.name ?? null,
      status: 'connected',
      scopes: grantedScopes,
      vault_secret_name: vaultSecretName,
      token_expires_at: tokenExpiresAt,
      last_synced_at: account ? new Date().toISOString() : null,
      sync_error: syncError,
      created_by: stateRow.created_by,
    });

    await upsertConnection('youtube', {
      account_label: null,
      account_identifier: null,
      status: youtubeGranted ? 'connected' : 'error',
      scopes: grantedScopes,
      vault_secret_name: vaultSecretName,
      token_expires_at: tokenExpiresAt,
      last_synced_at: youtubeGranted ? new Date().toISOString() : null,
      sync_error: youtubeGranted ? null : 'YouTube upload access was not granted during sign-in. Reconnect and make sure the consent screen includes YouTube.',
      created_by: stateRow.created_by,
    });

    return redirect({ connected: 'google_business' });
  } catch (error) {
    console.error('google-business-oauth-callback error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return redirect({ connection_error: msg });
  }
});
