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
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

const BUSINESS_INFO_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REFRESH_BUFFER_MS = 60_000;
const UPDATE_MASK = 'title,phoneNumbers,websiteUri,profile,storefrontAddress,regularHours';
const DAY_NAME_TO_GOOGLE = {
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
  Sunday: 'SUNDAY',
} as const;

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at?: string;
  obtained_at: string;
}

interface BusinessInfo {
  name: string;
  phone: string;
  website: string;
  description: string;
}

interface BusinessAddress {
  street_address: string | null;
  address_locality: string | null;
  address_region: string | null;
  postal_code: string | null;
  address_country: string | null;
}

interface BusinessHour {
  day_of_week: keyof typeof DAY_NAME_TO_GOOGLE;
  opens: string | null;
  closes: string | null;
  is_closed: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timeOfDay(value: string) {
  const [hours, minutes] = value.split(':').map((n) => parseInt(n, 10));
  return { hours: hours || 0, minutes: minutes || 0 };
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error_description || body?.error || 'Failed to refresh the Google access token');
  }
  return body;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: 'Google Business Profile is not configured yet on the server.' }, 501);
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
      .select('id, account_identifier, external_resource_id, vault_secret_name')
      .eq('provider', 'google_business')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (connErr || !connection?.vault_secret_name) {
      return json({ error: 'Google Business Profile is not connected. Connect it under Admin → Connections first.' }, 400);
    }

    const markSyncResult = async (syncError: string | null) => {
      await admin
        .from('integration_connections')
        .update({
          sync_error: syncError,
          last_synced_at: syncError ? null : new Date().toISOString(),
        })
        .eq('id', connection.id);
    };

    const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
      p_name: connection.vault_secret_name,
    });
    if (secretErr || !secretJson) {
      return json({ error: 'Could not load the stored Google credentials. Try reconnecting.' }, 500);
    }
    const tokens = JSON.parse(secretJson) as GoogleTokens;

    let accessToken = tokens.access_token;
    const isStale = !tokens.expires_at || new Date(tokens.expires_at).getTime() - REFRESH_BUFFER_MS <= Date.now();
    if (isStale) {
      if (!tokens.refresh_token) {
        return json({ error: 'The stored Google credentials have expired and cannot be refreshed. Reconnect under Admin → Connections.' }, 401);
      }
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      accessToken = refreshed.access_token;
      const updated: GoogleTokens = {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        obtained_at: new Date().toISOString(),
      };
      const { error: updateErr } = await admin.rpc('update_vault_secret', {
        p_name: connection.vault_secret_name,
        p_secret: JSON.stringify(updated),
      });
      if (updateErr) console.error('sync-google-business-profile failed to persist refreshed token:', updateErr);
    }

    // Resolve (and cache) the Business Profile location resource name.
    let locationName = connection.external_resource_id;
    if (!locationName) {
      if (!connection.account_identifier) {
        const msg = 'No Google Business Profile account is available yet. This usually means Google Business Profile API access is still pending approval.';
        await markSyncResult(msg);
        return json({ error: msg }, 409);
      }
      const listRes = await fetch(
        `${BUSINESS_INFO_URL}/${connection.account_identifier}/locations?readMask=name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!listRes.ok) {
        const msg = 'Could not look up your Google Business Profile location. This usually means Google Business Profile API access is still pending approval.';
        await markSyncResult(msg);
        return json({ error: msg }, listRes.status);
      }
      const listBody = await listRes.json().catch(() => ({}));
      const firstLocation = listBody?.locations?.[0]?.name as string | undefined;
      if (!firstLocation) {
        const msg = 'No locations were found on your connected Google Business Profile account.';
        await markSyncResult(msg);
        return json({ error: msg }, 404);
      }
      locationName = firstLocation;
      await admin.from('integration_connections').update({ external_resource_id: locationName }).eq('id', connection.id);
    }

    const { data: businessInfo, error: infoErr } = await admin
      .from('business_info')
      .select('id, name, phone, website, description')
      .eq('is_active', true)
      .maybeSingle();
    if (infoErr || !businessInfo) {
      return json({ error: 'Business information not found.' }, 500);
    }
    const info = businessInfo as BusinessInfo & { id: string };

    const { data: address } = await admin
      .from('business_address')
      .select('street_address, address_locality, address_region, postal_code, address_country')
      .eq('business_id', info.id)
      .maybeSingle();

    const { data: hours } = await admin
      .from('business_hours')
      .select('day_of_week, opens, closes, is_closed')
      .eq('business_id', info.id);

    const addr = address as BusinessAddress | null;
    const locationBody: Record<string, unknown> = {
      title: info.name,
      phoneNumbers: { primaryPhone: info.phone },
      websiteUri: info.website,
      profile: { description: info.description },
    };

    if (addr && (addr.address_locality || addr.street_address)) {
      locationBody.storefrontAddress = {
        addressLines: addr.street_address ? [addr.street_address] : [],
        locality: addr.address_locality ?? undefined,
        administrativeArea: addr.address_region ?? undefined,
        postalCode: addr.postal_code ?? undefined,
        regionCode: addr.address_country ?? undefined,
      };
    }

    const periods = ((hours ?? []) as BusinessHour[])
      .filter((h) => !h.is_closed && h.opens && h.closes)
      .map((h) => ({
        openDay: DAY_NAME_TO_GOOGLE[h.day_of_week],
        openTime: timeOfDay(h.opens!),
        closeDay: DAY_NAME_TO_GOOGLE[h.day_of_week],
        closeTime: timeOfDay(h.closes!),
      }));
    if (periods.length > 0) {
      locationBody.regularHours = { periods };
    }

    const patchRes = await fetch(
      `${BUSINESS_INFO_URL}/${locationName}?updateMask=${encodeURIComponent(UPDATE_MASK)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationBody),
      },
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      const msg = errBody?.error?.message || 'Google rejected the profile update.';
      await markSyncResult(msg);
      return json({ error: msg }, patchRes.status);
    }

    await markSyncResult(null);
    return json({ success: true });
  } catch (error) {
    console.error('sync-google-business-profile error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
