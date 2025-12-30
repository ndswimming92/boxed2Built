import { supabase } from '../lib/supabase';

export interface SitePage {
  id: string;
  title: string;
  url_path: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SitePageInsert {
  title: string;
  url_path: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface SitePageUpdate {
  title?: string;
  url_path?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export async function getActiveSitePages(): Promise<SitePage[]> {
  const { data, error } = await supabase
    .from('site_pages')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch site pages: ${error.message}`);
  }

  return data || [];
}

export async function getAllSitePages(): Promise<SitePage[]> {
  const { data, error } = await supabase
    .from('site_pages')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch site pages: ${error.message}`);
  }

  return data || [];
}

export async function getSitePageById(id: string): Promise<SitePage | null> {
  const { data, error } = await supabase
    .from('site_pages')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch site page: ${error.message}`);
  }

  return data;
}

export async function createSitePage(page: SitePageInsert): Promise<SitePage> {
  const { data, error } = await supabase
    .from('site_pages')
    .insert(page)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create site page: ${error.message}`);
  }

  return data;
}

export async function updateSitePage(id: string, updates: SitePageUpdate): Promise<SitePage> {
  const { data, error } = await supabase
    .from('site_pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update site page: ${error.message}`);
  }

  return data;
}

export async function deleteSitePage(id: string): Promise<void> {
  const { error } = await supabase
    .from('site_pages')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete site page: ${error.message}`);
  }
}

export function buildFullUrl(urlPath: string): string {
  const baseUrl = window.location.origin;

  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }

  const cleanPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return `${baseUrl}${cleanPath}`;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
