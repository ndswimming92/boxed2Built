import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import {
  DATA_API,
  TOTAL_METRICS,
  analyticsQuery,
  daysAgo,
  getYoutubeAccessToken,
  googleGet,
  isoDate,
  totalsFrom,
  youtubeConfigured,
} from '../_shared/youtube.ts';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Customer-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Stores one row per day: the channel's running totals as of today, plus the
// previous full day's activity. YouTube only keeps channel-level subscriber
// and view totals as a single current number, so this is the only way to see
// growth over time beyond what the analytics window offers.
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const authz = await authorizeAdminOrService(req);
    if (!authz.ok) return json({ error: authz.error ?? 'Unauthorized' }, authz.status ?? 401);

    if (!youtubeConfigured()) return json({ error: 'YouTube is not configured on the server.' }, 501);

    const auth = await getYoutubeAccessToken();
    if (!auth.ok) {
      // Not connected is an expected state, not a failure worth retrying.
      return json({ skipped: true, reason: auth.error }, auth.connected ? auth.status : 200);
    }

    const yesterday = isoDate(daysAgo(1));
    const [channelRes, dayRes] = await Promise.all([
      googleGet(`${DATA_API}/channels?part=statistics&mine=true`, auth.accessToken),
      analyticsQuery(auth.accessToken, { startDate: yesterday, endDate: yesterday, metrics: TOTAL_METRICS }),
    ]);
    const stats = channelRes.ok ? channelRes.body.items?.[0]?.statistics : null;
    if (!stats) return json({ error: 'Could not read channel statistics.' }, 502);

    const day = totalsFrom(dayRes);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.from('youtube_daily_snapshots').upsert(
      {
        snapshot_date: isoDate(new Date()),
        subscribers_total: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount ?? 0),
        total_views: Number(stats.viewCount ?? 0),
        video_count: Number(stats.videoCount ?? 0),
        views: day ? Number(day.views ?? 0) : null,
        watch_minutes: day ? Number(day.estimatedMinutesWatched ?? 0) : null,
        subscribers_net: day ? Number(day.subscribersGained ?? 0) - Number(day.subscribersLost ?? 0) : null,
        likes: day ? Number(day.likes ?? 0) : null,
        comments: day ? Number(day.comments ?? 0) : null,
        shares: day ? Number(day.shares ?? 0) : null,
      },
      { onConflict: 'snapshot_date' },
    );
    if (error) throw new Error(error.message);

    return json({ ok: true, snapshot_date: isoDate(new Date()) });
  } catch (error) {
    console.error('snapshot-youtube-stats error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
