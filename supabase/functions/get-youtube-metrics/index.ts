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
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

const DATA_API = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';
const REFRESH_BUFFER_MS = 60_000;
const ALLOWED_RANGES = [7, 28, 90];
const DEFAULT_RANGE = 28;

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at?: string;
  obtained_at: string;
}

interface AnalyticsResult {
  ok: boolean;
  rows: (string | number)[][];
  columns: string[];
  error: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function googleErrorMessage(body: unknown, fallback: string): string {
  const err = (body as { error?: { message?: string } })?.error;
  return err?.message || fallback;
}

async function googleGet(url: string, accessToken: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function analyticsQuery(
  accessToken: string,
  params: Record<string, string>,
): Promise<AnalyticsResult> {
  const qs = new URLSearchParams({ ids: 'channel==MINE', ...params });
  const res = await googleGet(`${ANALYTICS_API}?${qs.toString()}`, accessToken);
  if (!res.ok) {
    return { ok: false, rows: [], columns: [], error: googleErrorMessage(res.body, `Analytics request failed (${res.status})`) };
  }
  const columns = ((res.body.columnHeaders || []) as { name: string }[]).map((c) => c.name);
  return { ok: true, rows: res.body.rows || [], columns, error: null };
}

function rowsToObjects(result: AnalyticsResult): Record<string, string | number>[] {
  return result.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    result.columns.forEach((c, i) => {
      obj[c] = row[i];
    });
    return obj;
  });
}

const TOTAL_METRICS = 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost';

function totalsFrom(result: AnalyticsResult): Record<string, number> | null {
  if (!result.ok) return null;
  const row = rowsToObjects(result)[0];
  if (!row) {
    return Object.fromEntries(TOTAL_METRICS.split(',').map((m) => [m, 0]));
  }
  return row as Record<string, number>;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: 'YouTube stats are not configured yet on the server.' }, 501);
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

    const rangeParam = Number(new URL(req.url).searchParams.get('days'));
    const days = ALLOWED_RANGES.includes(rangeParam) ? rangeParam : DEFAULT_RANGE;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connErr } = await admin
      .from('integration_connections')
      .select('vault_secret_name')
      .eq('provider', 'youtube')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (connErr || !connection?.vault_secret_name) {
      return json({ connected: false, fetched_at: new Date().toISOString() });
    }

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
      if (updateErr) console.error('get-youtube-metrics failed to persist refreshed token:', updateErr);
    }

    // Analytics data lags ~2 days, so end the window at yesterday.
    const endDate = isoDate(daysAgo(1));
    const startDate = isoDate(daysAgo(days));
    const prevEnd = isoDate(daysAgo(days + 1));
    const prevStart = isoDate(daysAgo(days * 2));
    const range = { startDate, endDate };

    const [
      channelRes,
      trendRes,
      totalsRes,
      prevTotalsRes,
      trafficRes,
      contentTypeRes,
      topVideosRes,
      countriesRes,
    ] = await Promise.all([
      googleGet(`${DATA_API}/channels?part=snippet,statistics&mine=true`, accessToken),
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'day',
        metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
        sort: 'day',
      }),
      analyticsQuery(accessToken, { ...range, metrics: TOTAL_METRICS }),
      analyticsQuery(accessToken, { startDate: prevStart, endDate: prevEnd, metrics: TOTAL_METRICS }),
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'insightTrafficSourceType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'creatorContentType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'video',
        metrics: 'views,estimatedMinutesWatched,likes,comments',
        sort: '-views',
        maxResults: '10',
      }),
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'country',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
        maxResults: '5',
      }),
    ]);

    if (!channelRes.ok && (channelRes.status === 401 || channelRes.status === 403)) {
      return json({
        connected: true,
        needs_reconnect: true,
        error: googleErrorMessage(channelRes.body, 'YouTube denied access.'),
        fetched_at: new Date().toISOString(),
      });
    }

    const channelItem = channelRes.ok ? channelRes.body.items?.[0] : null;
    const channel = channelItem
      ? {
          id: channelItem.id as string,
          title: channelItem.snippet?.title as string,
          thumbnail: (channelItem.snippet?.thumbnails?.default?.url as string) ?? null,
          subscribers: channelItem.statistics?.hiddenSubscriberCount ? null : Number(channelItem.statistics?.subscriberCount ?? 0),
          total_views: Number(channelItem.statistics?.viewCount ?? 0),
          video_count: Number(channelItem.statistics?.videoCount ?? 0),
        }
      : null;

    const trend = trendRes.ok
      ? rowsToObjects(trendRes).map((r) => ({
          date: r.day as string,
          views: Number(r.views),
          watch_hours: Math.round((Number(r.estimatedMinutesWatched) / 60) * 100) / 100,
          subscribers_net: Number(r.subscribersGained) - Number(r.subscribersLost),
        }))
      : [];

    // Attach titles/thumbnails to the top videos via the Data API.
    let topVideos: Record<string, unknown>[] = [];
    if (topVideosRes.ok) {
      const rows = rowsToObjects(topVideosRes);
      const ids = rows.map((r) => r.video as string);
      const titles = new Map<string, { title: string; thumbnail: string | null }>();
      if (ids.length > 0) {
        const vids = await googleGet(`${DATA_API}/videos?part=snippet&id=${ids.join(',')}`, accessToken);
        if (vids.ok) {
          for (const item of vids.body.items || []) {
            titles.set(item.id, {
              title: item.snippet?.title,
              thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
            });
          }
        }
      }
      topVideos = rows.map((r) => ({
        video_id: r.video,
        title: titles.get(r.video as string)?.title ?? r.video,
        thumbnail: titles.get(r.video as string)?.thumbnail ?? null,
        views: Number(r.views),
        watch_hours: Math.round((Number(r.estimatedMinutesWatched) / 60) * 100) / 100,
        likes: Number(r.likes),
        comments: Number(r.comments),
      }));
    }

    const mapSimple = (res: AnalyticsResult, dim: string) =>
      res.ok
        ? rowsToObjects(res).map((r) => ({
            key: r[dim] as string,
            views: Number(r.views),
            watch_hours: Math.round((Number(r.estimatedMinutesWatched) / 60) * 100) / 100,
          }))
        : [];

    const analyticsErrors = [trendRes, totalsRes, trafficRes, contentTypeRes, topVideosRes, countriesRes]
      .map((r) => r.error)
      .filter((e): e is string => !!e);

    return json({
      connected: true,
      days,
      period: { start: startDate, end: endDate, previous_start: prevStart, previous_end: prevEnd },
      channel,
      channel_error: channelRes.ok ? null : googleErrorMessage(channelRes.body, 'Could not load channel details'),
      totals: totalsFrom(totalsRes),
      previous_totals: totalsFrom(prevTotalsRes),
      trend,
      traffic_sources: mapSimple(trafficRes, 'insightTrafficSourceType'),
      content_types: mapSimple(contentTypeRes, 'creatorContentType'),
      top_videos: topVideos,
      countries: mapSimple(countriesRes, 'country'),
      analytics_error: analyticsErrors[0] ?? null,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-youtube-metrics error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
