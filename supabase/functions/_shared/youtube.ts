import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

export const DATA_API = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';
const REFRESH_BUFFER_MS = 60_000;

export const TOTAL_METRICS =
  'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost';

export type ContentFilter = 'all' | 'shorts' | 'video';

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at?: string;
  obtained_at: string;
}

export interface AnalyticsResult {
  ok: boolean;
  rows: (string | number)[][];
  columns: string[];
  error: string | null;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; connected: boolean; status: number; error: string };

export class YoutubeNotConfiguredError extends Error {}

export function youtubeConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;
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

/** Loads the stored YouTube credentials from Vault and refreshes them when stale. */
export async function getYoutubeAccessToken(): Promise<AccessTokenResult> {
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
    return { ok: false, connected: false, status: 400, error: 'YouTube is not connected.' };
  }

  const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
    p_name: connection.vault_secret_name,
  });
  if (secretErr || !secretJson) {
    return { ok: false, connected: true, status: 500, error: 'Could not load the stored Google credentials. Try reconnecting.' };
  }
  const tokens = JSON.parse(secretJson) as GoogleTokens;

  const isStale = !tokens.expires_at || new Date(tokens.expires_at).getTime() - REFRESH_BUFFER_MS <= Date.now();
  if (!isStale) return { ok: true, accessToken: tokens.access_token };

  if (!tokens.refresh_token) {
    return {
      ok: false,
      connected: true,
      status: 401,
      error: 'The stored Google credentials have expired and cannot be refreshed. Reconnect under Admin → Connections.',
    };
  }
  const refreshed = await refreshAccessToken(tokens.refresh_token);
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
  if (updateErr) console.error('youtube token refresh failed to persist:', updateErr);
  return { ok: true, accessToken: refreshed.access_token };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function googleErrorMessage(body: unknown, fallback: string): string {
  const err = (body as { error?: { message?: string } })?.error;
  return err?.message || fallback;
}

export async function googleGet(
  url: string,
  accessToken: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function analyticsQuery(accessToken: string, params: Record<string, string>): Promise<AnalyticsResult> {
  const qs = new URLSearchParams({ ids: 'channel==MINE', ...params });
  const res = await googleGet(`${ANALYTICS_API}?${qs.toString()}`, accessToken);
  if (!res.ok) {
    return {
      ok: false,
      rows: [],
      columns: [],
      error: googleErrorMessage(res.body, `Analytics request failed (${res.status})`),
    };
  }
  const columns = ((res.body.columnHeaders || []) as { name: string }[]).map((c) => c.name);
  return { ok: true, rows: res.body.rows || [], columns, error: null };
}

export function rowsToObjects(result: AnalyticsResult): Record<string, string | number>[] {
  return result.rows.map((row) => {
    const obj: Record<string, string | number> = {};
    result.columns.forEach((c, i) => {
      obj[c] = row[i];
    });
    return obj;
  });
}

export function totalsFrom(result: AnalyticsResult): Record<string, number> | null {
  if (!result.ok) return null;
  const row = rowsToObjects(result)[0];
  if (!row) return Object.fromEntries(TOTAL_METRICS.split(',').map((m) => [m, 0]));
  return row as Record<string, number>;
}

/** Analytics `filters` fragment for a Shorts/Videos toggle ('' = no filter). */
export function contentTypeFilter(filter: ContentFilter): string {
  if (filter === 'shorts') return 'creatorContentType==SHORTS';
  if (filter === 'video') return 'creatorContentType==VIDEO_ON_DEMAND';
  return '';
}

export function joinFilters(...parts: string[]): Record<string, string> {
  const joined = parts.filter(Boolean).join(';');
  return joined ? { filters: joined } : {};
}

export function hours(minutes: number): number {
  return Math.round((Number(minutes) / 60) * 100) / 100;
}

export interface DemographicRow {
  age_group: string;
  gender: string;
  percentage: number;
}

export function demographicsFrom(result: AnalyticsResult): DemographicRow[] {
  if (!result.ok) return [];
  return rowsToObjects(result).map((r) => ({
    age_group: String(r.ageGroup).replace('age', ''),
    gender: String(r.gender),
    percentage: Math.round(Number(r.viewerPercentage) * 10) / 10,
  }));
}
