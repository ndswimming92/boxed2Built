import { supabase } from '../lib/supabase';

export type AppBranding = {
  id: string;
  scope: string;
  theme_color: string;
  title: string;
  short_name: string;
  status_bar_style: string;
  icon_url: string | null;
  mark_text: string;
  mark_color: string;
  created_at: string;
  updated_at: string;
};

export const ADMIN_BRANDING_DEFAULTS: Omit<AppBranding, 'id' | 'created_at' | 'updated_at'> = {
  scope: 'admin',
  theme_color: '#1E3A8A',
  title: 'Boxed2Built Admin',
  short_name: 'B2B Admin',
  status_bar_style: 'black-translucent',
  icon_url: null,
  mark_text: 'Admin',
  mark_color: '#FFFFFF',
};

const CACHE_KEY = 'b2b.admin-branding';
const CACHE_TTL_MS = 60_000;

type CachedBranding = {
  payload: AppBranding;
  ts: number;
};

function readCache(): AppBranding | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedBranding = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache(payload: AppBranding) {
  try {
    const entry: CachedBranding = { payload, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage may be unavailable (private mode); fail silent
  }
}

export function clearBrandingCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function getCachedAdminBranding(): AppBranding | null {
  return readCache();
}

export async function fetchAdminBranding(useCache = true): Promise<AppBranding> {
  if (useCache) {
    const cached = readCache();
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('app_branding')
    .select('id,scope,theme_color,title,short_name,status_bar_style,icon_url,mark_text,mark_color,created_at,updated_at')
    .eq('scope', 'admin')
    .maybeSingle();

  if (error) {
    console.warn('Failed to fetch admin branding, using defaults', error);
    return {
      id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...ADMIN_BRANDING_DEFAULTS,
    };
  }

  if (!data) {
    return {
      id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...ADMIN_BRANDING_DEFAULTS,
    };
  }

  const payload = data as AppBranding;
  writeCache(payload);
  return payload;
}

export async function updateAdminBranding(
  id: string,
  patch: Partial<Pick<AppBranding, 'theme_color' | 'title' | 'short_name' | 'status_bar_style' | 'icon_url' | 'mark_text' | 'mark_color'>>
): Promise<AppBranding> {
  const { data, error } = await supabase
    .from('app_branding')
    .update(patch)
    .eq('id', id)
    .select('id,scope,theme_color,title,short_name,status_bar_style,icon_url,mark_text,mark_color,created_at,updated_at')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Branding row not found');

  const payload = data as AppBranding;
  writeCache(payload);
  return payload;
}

export function buildAdminIconDataUrl(themeColor: string, markColor: string, markText: string): string {
  const text = (markText || 'Admin').slice(0, 16);
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(themeColor) ? themeColor : '#1E3A8A';
  const safeMark = /^#[0-9a-fA-F]{3,8}$/.test(markColor) ? markColor : '#FFFFFF';
  const fontSize = text.length > 6 ? 88 : 112;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="96" fill="${safeColor}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-2" fill="${safeMark}">${text.replace(/[<>&]/g, '')}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
