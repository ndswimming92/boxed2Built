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
const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TREND_DAYS = 30;

interface FacebookTokens {
  page_access_token: string;
  page_id: string;
  page_name: string;
  ig_user_id: string | null;
  ig_username: string | null;
}

interface TrendPoint {
  date: string;
  [metric: string]: string | number;
}

interface MetricCandidate {
  key: string;
  label: string;
}

// Meta has deprecated Page/Instagram Insights metrics in several waves
// (impressions/reach-family metrics especially) — a name that works today may
// 400 next quarter. Each candidate is tried independently; whichever succeed
// are reported back (with their key/label) so the caller never has to
// hardcode which metric name is currently alive.
const FB_PAGE_METRIC_CANDIDATES: MetricCandidate[] = [
  { key: 'page_views_total', label: 'Page Views' },
  { key: 'page_fan_adds', label: 'New Followers' },
  { key: 'page_post_engagements', label: 'Post Engagements' },
  { key: 'page_impressions_unique', label: 'Reach' },
];

const IG_METRIC_CANDIDATES: MetricCandidate[] = [
  { key: 'reach', label: 'Reach' },
  { key: 'profile_views', label: 'Profile Views' },
  { key: 'accounts_engaged', label: 'Accounts Engaged' },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

// Fetches each candidate metric individually and merges whichever succeed,
// since Meta occasionally deprecates individual Insights metrics and a single
// bad metric name would otherwise fail the whole batched request.
async function fetchInsightsTrend(
  nodeId: string,
  accessToken: string,
  candidates: MetricCandidate[],
  extraParams: Record<string, string> = {}
): Promise<{ trend: TrendPoint[]; metrics: MetricCandidate[]; errors: string[] }> {
  const since = Math.floor((Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const byDate = new Map<string, TrendPoint>();
  const errors: string[] = [];
  const succeeded: MetricCandidate[] = [];

  await Promise.all(
    candidates.map(async (candidate) => {
      const { ok, body } = await graphGet(`/${nodeId}/insights`, {
        metric: candidate.key,
        period: 'day',
        since: String(since),
        until: String(until),
        access_token: accessToken,
        ...extraParams,
      });
      if (!ok) {
        errors.push(body?.error?.message || `Failed to load "${candidate.key}"`);
        return;
      }
      const series = body?.data?.[0]?.values as { end_time: string; value: number }[] | undefined;
      if (!series || series.length === 0) return;
      succeeded.push(candidate);
      for (const point of series) {
        const date = point.end_time.slice(0, 10);
        const row = byDate.get(date) ?? { date };
        row[candidate.key] = point.value;
        byDate.set(date, row);
      }
    })
  );

  const trend = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { trend, metrics: succeeded, errors };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
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

    const [pageFields, pageInsights] = await Promise.all([
      graphGet(`/${tokens.page_id}`, { fields: 'fan_count,name', access_token: tokens.page_access_token }),
      fetchInsightsTrend(tokens.page_id, tokens.page_access_token, FB_PAGE_METRIC_CANDIDATES),
    ]);

    const facebook = {
      connected: true,
      page_name: tokens.page_name,
      followers: pageFields.ok ? (pageFields.body.fan_count ?? null) : null,
      trend: pageInsights.trend,
      metrics: pageInsights.metrics,
      insights_error: pageInsights.trend.length === 0 ? pageInsights.errors[0] ?? null : null,
    };

    let instagram: Record<string, unknown> = { connected: false };
    if (tokens.ig_user_id) {
      const [igFields, igInsights] = await Promise.all([
        graphGet(`/${tokens.ig_user_id}`, {
          fields: 'followers_count,media_count,username',
          access_token: tokens.page_access_token,
        }),
        fetchInsightsTrend(tokens.ig_user_id, tokens.page_access_token, IG_METRIC_CANDIDATES, {
          metric_type: 'time_series',
        }),
      ]);

      instagram = {
        connected: true,
        username: tokens.ig_username,
        followers: igFields.ok ? (igFields.body.followers_count ?? null) : null,
        media_count: igFields.ok ? (igFields.body.media_count ?? null) : null,
        trend: igInsights.trend,
        metrics: igInsights.metrics,
        insights_error: igInsights.trend.length === 0 ? igInsights.errors[0] ?? null : null,
      };
    }

    return json({ facebook, instagram, fetched_at: new Date().toISOString() });
  } catch (error) {
    console.error('get-social-metrics error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
