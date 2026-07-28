import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_ADMIN_KEY = Deno.env.get('B2B_Claude_Usage');
const ANTHROPIC_API = 'https://api.anthropic.com/v1/organizations';
const ANTHROPIC_VERSION = '2023-06-01';
const TREND_DAYS = 30; // + today = 31 daily buckets, the API's max for bucket_width=1d

interface CostResultItem {
  amount: string;
  model: string | null;
}

interface CostBucket {
  starting_at: string;
  results: CostResultItem[];
}

interface UsageResultItem {
  model: string | null;
  uncached_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  cache_creation: { ephemeral_1h_input_tokens: number | null; ephemeral_5m_input_tokens: number | null } | null;
  output_tokens: number | null;
}

interface UsageBucket {
  starting_at: string;
  results: UsageResultItem[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUTCMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Both report endpoints paginate identically: { data, has_more, next_page }.
// A 31-day window at bucket_width=1d fits in one page, but we still follow
// next_page defensively rather than assume that always holds.
async function fetchAllBuckets<T>(baseUrl: string): Promise<T[]> {
  const buckets: T[] = [];
  let page: string | undefined;

  for (let i = 0; i < 10; i++) {
    const url = new URL(baseUrl);
    if (page) url.searchParams.set('page', page);

    const res = await fetch(url.toString(), {
      headers: {
        'x-api-key': ANTHROPIC_ADMIN_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Anthropic Admin API error (${res.status})`);
    }

    buckets.push(...((body.data ?? []) as T[]));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }

  return buckets;
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

    if (!ANTHROPIC_ADMIN_KEY) {
      return json({
        error: 'Claude Admin API key is not configured. Set the B2B_Claude_Usage secret in Supabase Edge Function settings.',
      }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await admin
      .from('claude_usage_settings')
      .select('monthly_budget_usd')
      .eq('id', true)
      .maybeSingle();
    const budget = settings ? Number(settings.monthly_budget_usd) : 0;

    const now = new Date();
    const monthStart = startOfUTCMonth(now);
    const trendStart = startOfUTCDay(new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000));
    // ending_at is exclusive, so this reaches through the end of today's bucket
    const trendEnd = new Date(startOfUTCDay(now).getTime() + 24 * 60 * 60 * 1000);

    const costParams = new URLSearchParams({
      starting_at: trendStart.toISOString(),
      ending_at: trendEnd.toISOString(),
      bucket_width: '1d',
      limit: '31',
    });
    costParams.append('group_by[]', 'description');

    const usageParams = new URLSearchParams({
      starting_at: monthStart.toISOString(),
      ending_at: trendEnd.toISOString(),
      bucket_width: '1d',
      limit: '31',
    });
    usageParams.append('group_by[]', 'model');

    const [costBuckets, usageBuckets] = await Promise.all([
      fetchAllBuckets<CostBucket>(`${ANTHROPIC_API}/cost_report?${costParams.toString()}`),
      fetchAllBuckets<UsageBucket>(`${ANTHROPIC_API}/usage_report/messages?${usageParams.toString()}`),
    ]);

    const trend: { date: string; cost_usd: number }[] = [];
    const byModelCost = new Map<string, number>();
    let spentThisMonth = 0;

    for (const bucket of costBuckets) {
      // amount is a decimal string in cents (e.g. "123.45" => $1.23)
      const dayTotal = bucket.results.reduce((sum, r) => sum + parseFloat(r.amount) / 100, 0);
      trend.push({ date: bucket.starting_at.slice(0, 10), cost_usd: round2(dayTotal) });

      if (new Date(bucket.starting_at) >= monthStart) {
        spentThisMonth += dayTotal;
        for (const r of bucket.results) {
          const key = r.model ?? 'other';
          byModelCost.set(key, (byModelCost.get(key) ?? 0) + parseFloat(r.amount) / 100);
        }
      }
    }
    trend.sort((a, b) => a.date.localeCompare(b.date));

    const byModelTokens = new Map<
      string,
      { input: number; output: number; cache_read: number; cache_creation: number }
    >();
    for (const bucket of usageBuckets) {
      for (const r of bucket.results) {
        const key = r.model ?? 'other';
        const entry = byModelTokens.get(key) ?? { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
        entry.input += r.uncached_input_tokens ?? 0;
        entry.output += r.output_tokens ?? 0;
        entry.cache_read += r.cache_read_input_tokens ?? 0;
        entry.cache_creation +=
          (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
        byModelTokens.set(key, entry);
      }
    }

    const modelKeys = new Set([...byModelCost.keys(), ...byModelTokens.keys()]);
    const byModel = Array.from(modelKeys)
      .map((model) => {
        const tokens = byModelTokens.get(model) ?? { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
        return {
          model,
          input_tokens: tokens.input,
          output_tokens: tokens.output,
          cache_read_tokens: tokens.cache_read,
          cache_creation_tokens: tokens.cache_creation,
          cost_usd: round2(byModelCost.get(model) ?? 0),
        };
      })
      .sort((a, b) => b.cost_usd - a.cost_usd);

    return json({
      fetched_at: new Date().toISOString(),
      budget_usd: round2(budget),
      spent_this_month_usd: round2(spentThisMonth),
      remaining_usd: round2(budget - spentThisMonth),
      percent_used: budget > 0 ? round2((spentThisMonth / budget) * 100) : null,
      trend,
      by_model: byModel,
    });
  } catch (error) {
    console.error('get-claude-usage error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
