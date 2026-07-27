import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiRequestLog {
  id: string;
  api_key_id: string;
  method: string;
  path: string;
  status_code: number;
  error: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type ConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected';

export interface IntegrationConnection {
  id: string;
  provider: string;
  account_label: string | null;
  account_identifier: string | null;
  status: ConnectionStatus;
  scopes: string[];
  token_expires_at: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
}

export interface ApiScopeOption {
  value: string;
  label: string;
  description: string;
}

export const API_SCOPES: ApiScopeOption[] = [
  {
    value: 'inquiries:read',
    label: 'Inquiries — Read',
    description: 'List and view form inquiries (leads).',
  },
  {
    value: 'inquiries:write',
    label: 'Inquiries — Write',
    description: 'Submit new inquiries from external tools (Zapier, forms, partners).',
  },
  {
    value: 'jobs:read',
    label: 'Jobs — Read',
    description: 'List and view jobs and their pricing/schedule details.',
  },
  {
    value: 'invoices:read',
    label: 'Invoices — Read',
    description: 'List and view invoices (internal notes and payment tokens are never exposed).',
  },
  {
    value: 'clients:read',
    label: 'Clients — Read',
    description: 'List and view client records and marketing opt-in status.',
  },
];

export interface CreateApiKeyParams {
  name: string;
  scopes: string[];
  expires_in_days?: number | null;
  rate_limit_per_minute?: number | null;
}

export interface CreateApiKeyResult {
  api_key: string;
  record: ApiKey;
}

export async function createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/manage-api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'create', ...params }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to create API key');
  return body as CreateApiKeyResult;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, revoked_at, last_used_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ApiKey[]) ?? [];
}

export async function revokeApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function listApiRequestLogs(options?: {
  apiKeyId?: string;
  limit?: number;
}): Promise<ApiRequestLog[]> {
  let q = supabase
    .from('api_request_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);
  if (options?.apiKeyId) {
    q = q.eq('api_key_id', options.apiKeyId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as ApiRequestLog[]) ?? [];
}

export async function countRequestsSince(since: Date): Promise<number> {
  const { count, error } = await supabase
    .from('api_request_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function listConnections(): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from('integration_connections')
    .select('id, provider, account_label, account_identifier, status, scopes, token_expires_at, last_synced_at, sync_error, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as IntegrationConnection[]) ?? [];
}

export async function startGoogleBusinessConnect(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/google-business-oauth-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to start Google connection');
  return body.url as string;
}

export async function startFacebookConnect(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/facebook-oauth-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to start Facebook connection');
  return body.url as string;
}

export async function disconnectConnection(id: string): Promise<void> {
  const { error } = await supabase
    .from('integration_connections')
    .update({ status: 'disconnected' })
    .eq('id', id);
  if (error) throw error;
}

export function getApiBaseUrl(): string {
  return `${FN_URL}/api-v1`;
}

export interface SocialMetricsTrendPoint {
  date: string;
  [metric: string]: string | number;
}

export interface SocialMetricDescriptor {
  key: string;
  label: string;
}

export interface FacebookMetrics {
  connected: boolean;
  page_name?: string;
  followers: number | null;
  trend: SocialMetricsTrendPoint[];
  metrics: SocialMetricDescriptor[];
  insights_error: string | null;
}

export interface InstagramMetrics {
  connected: boolean;
  username?: string | null;
  followers?: number | null;
  media_count?: number | null;
  trend?: SocialMetricsTrendPoint[];
  metrics?: SocialMetricDescriptor[];
  insights_error?: string | null;
}

export interface SocialMetrics {
  facebook: FacebookMetrics;
  instagram: InstagramMetrics;
  fetched_at: string;
}

export async function getSocialMetrics(): Promise<SocialMetrics> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/get-social-metrics`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load social metrics');
  return body as SocialMetrics;
}

export type SocialCommentPlatform = 'facebook' | 'instagram';

export interface SocialComment {
  id: string;
  platform: SocialCommentPlatform;
  post_id: string;
  post_permalink: string | null;
  author: string;
  message: string;
  created_time: string;
  replied: boolean;
}

export interface SocialCommentsResult {
  comments: SocialComment[];
  unreplied_count: number;
  facebook_error: string | null;
  instagram_error: string | null;
  fetched_at: string;
}

export async function getSocialComments(): Promise<SocialCommentsResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/get-social-comments`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load comments');
  return body as SocialCommentsResult;
}

export async function replySocialComment(
  platform: SocialCommentPlatform,
  commentId: string,
  message: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/reply-social-comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ platform, comment_id: commentId, message }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to send reply');
}

export interface SocialConversation {
  id: string;
  platform: SocialCommentPlatform;
  participant_id: string;
  participant_name: string;
  last_message: string;
  last_message_time: string;
  needs_reply: boolean;
}

export interface SocialConversationsResult {
  conversations: SocialConversation[];
  needs_reply_count: number;
  facebook_error: string | null;
  instagram_error: string | null;
  fetched_at: string;
}

export async function getSocialConversations(): Promise<SocialConversationsResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/get-social-conversations`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load conversations');
  return body as SocialConversationsResult;
}

export async function sendSocialMessage(recipientId: string, message: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/send-social-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recipient_id: recipientId, message }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to send message');
}
