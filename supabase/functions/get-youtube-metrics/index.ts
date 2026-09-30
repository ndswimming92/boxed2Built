import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import {
  DATA_API,
  TOTAL_METRICS,
  analyticsQuery,
  contentTypeFilter,
  type ContentFilter,
  daysAgo,
  demographicsFrom,
  getYoutubeAccessToken,
  googleErrorMessage,
  googleGet,
  hours,
  isoDate,
  joinFilters,
  rowsToObjects,
  totalsFrom,
  youtubeConfigured,
  type AnalyticsResult,
} from '../_shared/youtube.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_RANGES = [7, 28, 90];
const DEFAULT_RANGE = 28;
const CONTENT_FILTERS: ContentFilter[] = ['all', 'shorts', 'video'];
const HISTORY_DAYS = 365;

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
    if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    if (!youtubeConfigured()) {
      return json({ error: 'YouTube stats are not configured yet on the server.' }, 501);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
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

    const url = new URL(req.url);
    const rangeParam = Number(url.searchParams.get('days'));
    const days = ALLOWED_RANGES.includes(rangeParam) ? rangeParam : DEFAULT_RANGE;
    const typeParam = url.searchParams.get('type') as ContentFilter;
    const contentType: ContentFilter = CONTENT_FILTERS.includes(typeParam) ? typeParam : 'all';

    const auth = await getYoutubeAccessToken();
    if (!auth.ok) {
      if (!auth.connected) return json({ connected: false, fetched_at: new Date().toISOString() });
      return json({ error: auth.error }, auth.status);
    }
    const accessToken = auth.accessToken;

    // Analytics data lags ~2 days, so end the window at yesterday.
    const endDate = isoDate(daysAgo(1));
    const startDate = isoDate(daysAgo(days));
    const prevEnd = isoDate(daysAgo(days + 1));
    const prevStart = isoDate(daysAgo(days * 2));
    const range = { startDate, endDate };
    const typeFilter = joinFilters(contentTypeFilter(contentType));

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [
      channelRes,
      trendRes,
      totalsRes,
      prevTotalsRes,
      trafficRes,
      contentTypeRes,
      topVideosRes,
      countriesRes,
      demographicsRes,
      devicesRes,
      subscribedRes,
      historyRes,
    ] = await Promise.all([
      googleGet(`${DATA_API}/channels?part=snippet,statistics&mine=true`, accessToken),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'day',
        metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
        sort: 'day',
      }),
      analyticsQuery(accessToken, { ...range, ...typeFilter, metrics: TOTAL_METRICS }),
      analyticsQuery(accessToken, { startDate: prevStart, endDate: prevEnd, ...typeFilter, metrics: TOTAL_METRICS }),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'insightTrafficSourceType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      // Always unfiltered: this table is the Shorts vs. videos comparison itself.
      analyticsQuery(accessToken, {
        ...range,
        dimensions: 'creatorContentType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'video',
        metrics: 'views,estimatedMinutesWatched,likes,comments',
        sort: '-views',
        maxResults: '10',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'country',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
        maxResults: '5',
      }),
      // Demographics are withheld by YouTube below a privacy threshold, in which
      // case the query succeeds with zero rows.
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'ageGroup,gender',
        metrics: 'viewerPercentage',
        sort: 'gender,ageGroup',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'deviceType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...typeFilter,
        dimensions: 'subscribedStatus',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      admin
        .from('youtube_daily_snapshots')
        .select('snapshot_date, subscribers_total, total_views, video_count, views, watch_minutes, subscribers_net')
        .gte('snapshot_date', isoDate(daysAgo(HISTORY_DAYS)))
        .order('snapshot_date', { ascending: true }),
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
          watch_hours: hours(Number(r.estimatedMinutesWatched)),
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
        watch_hours: hours(Number(r.estimatedMinutesWatched)),
        likes: Number(r.likes),
        comments: Number(r.comments),
      }));
    }

    const mapSimple = (res: AnalyticsResult, dim: string) =>
      res.ok
        ? rowsToObjects(res).map((r) => ({
            key: r[dim] as string,
            views: Number(r.views),
            watch_hours: hours(Number(r.estimatedMinutesWatched)),
          }))
        : [];

    const analyticsErrors = [
      trendRes, totalsRes, trafficRes, contentTypeRes, topVideosRes, countriesRes, demographicsRes, devicesRes, subscribedRes,
    ]
      .map((r) => r.error)
      .filter((e): e is string => !!e);

    return json({
      connected: true,
      days,
      content_type: contentType,
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
      demographics: demographicsFrom(demographicsRes),
      demographics_available: demographicsRes.ok,
      devices: mapSimple(devicesRes, 'deviceType'),
      subscribed_status: mapSimple(subscribedRes, 'subscribedStatus'),
      history: historyRes.error ? [] : historyRes.data ?? [],
      analytics_error: analyticsErrors[0] ?? null,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-youtube-metrics error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
