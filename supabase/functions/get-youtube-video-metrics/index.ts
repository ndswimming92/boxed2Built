import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  DATA_API,
  TOTAL_METRICS,
  analyticsQuery,
  daysAgo,
  demographicsFrom,
  getYoutubeAccessToken,
  googleGet,
  hours,
  isoDate,
  rowsToObjects,
  totalsFrom,
  youtubeConfigured,
  type AnalyticsResult,
} from '../_shared/youtube.ts';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ALLOWED_RANGES = [7, 28, 90];
const DEFAULT_RANGE = 28;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

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

    const authz = await authorizeAdminOrService(req);
    if (!authz.ok) return json({ error: authz.error ?? 'Unauthorized' }, authz.status ?? 401);

    const url = new URL(req.url);
    const videoId = url.searchParams.get('video_id') ?? '';
    if (!VIDEO_ID_PATTERN.test(videoId)) return json({ error: 'video_id is required' }, 400);
    const rangeParam = Number(url.searchParams.get('days'));
    const days = ALLOWED_RANGES.includes(rangeParam) ? rangeParam : DEFAULT_RANGE;

    const auth = await getYoutubeAccessToken();
    if (!auth.ok) return json({ error: auth.error }, auth.connected ? auth.status : 400);
    const accessToken = auth.accessToken;

    const range = { startDate: isoDate(daysAgo(days)), endDate: isoDate(daysAgo(1)) };
    const filters = { filters: `video==${videoId}` };

    const [videoRes, totalsRes, trendRes, trafficRes, demographicsRes, countriesRes, retentionRes] = await Promise.all([
      googleGet(`${DATA_API}/videos?part=snippet,statistics,contentDetails&id=${videoId}`, accessToken),
      analyticsQuery(accessToken, { ...range, ...filters, metrics: TOTAL_METRICS }),
      analyticsQuery(accessToken, {
        ...range,
        ...filters,
        dimensions: 'day',
        metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
        sort: 'day',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...filters,
        dimensions: 'insightTrafficSourceType',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...filters,
        dimensions: 'ageGroup,gender',
        metrics: 'viewerPercentage',
        sort: 'gender,ageGroup',
      }),
      analyticsQuery(accessToken, {
        ...range,
        ...filters,
        dimensions: 'country',
        metrics: 'views,estimatedMinutesWatched',
        sort: '-views',
        maxResults: '5',
      }),
      // Audience retention is a lifetime report (date range is not accepted).
      analyticsQuery(accessToken, {
        ...filters,
        dimensions: 'elapsedVideoTimeRatio',
        metrics: 'audienceWatchRatio',
        sort: 'elapsedVideoTimeRatio',
      }),
    ]);

    const item = videoRes.ok ? videoRes.body.items?.[0] : null;
    if (!item) return json({ error: 'Video not found on this channel.' }, 404);

    const mapSimple = (res: AnalyticsResult) =>
      res.ok
        ? rowsToObjects(res).map((r) => ({
            key: r.insightTrafficSourceType ?? r.country,
            views: Number(r.views),
            watch_hours: hours(Number(r.estimatedMinutesWatched)),
          }))
        : [];

    return json({
      video: {
        id: item.id as string,
        title: item.snippet?.title as string,
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
        published_at: item.snippet?.publishedAt as string,
        lifetime_views: Number(item.statistics?.viewCount ?? 0),
        lifetime_likes: Number(item.statistics?.likeCount ?? 0),
        lifetime_comments: Number(item.statistics?.commentCount ?? 0),
        duration: item.contentDetails?.duration as string,
      },
      days,
      totals: totalsFrom(totalsRes),
      trend: trendRes.ok
        ? rowsToObjects(trendRes).map((r) => ({
            date: r.day as string,
            views: Number(r.views),
            watch_hours: hours(Number(r.estimatedMinutesWatched)),
            subscribers_net: Number(r.subscribersGained) - Number(r.subscribersLost),
          }))
        : [],
      traffic_sources: mapSimple(trafficRes),
      countries: mapSimple(countriesRes),
      demographics: demographicsFrom(demographicsRes),
      demographics_available: demographicsRes.ok,
      retention: retentionRes.ok
        ? rowsToObjects(retentionRes).map((r) => ({
            position: Math.round(Number(r.elapsedVideoTimeRatio) * 100),
            watch_ratio: Math.round(Number(r.audienceWatchRatio) * 1000) / 10,
          }))
        : [],
      analytics_error: [totalsRes, trendRes, trafficRes, demographicsRes, countriesRes, retentionRes]
        .map((r) => r.error)
        .find((e) => !!e) ?? null,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-youtube-video-metrics error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
