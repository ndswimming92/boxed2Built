import { normalizeApiKey } from './sentTemplates.ts';

/**
 * The Sent (sent.dm) API key from the Supabase secrets. The key is stored as
 * Sent_API_Key; SENT_DM_API_KEY is the older name, so either is accepted. Secret
 * names are case-sensitive, and Sent_API_Key wins when both are set so a stale
 * value under the old name cannot hide the live key.
 */
export function sentApiKeyInfo(): { key: string | undefined; source: 'Sent_API_Key' | 'SENT_DM_API_KEY' | null } {
  const preferred = normalizeApiKey(Deno.env.get('Sent_API_Key'));
  if (preferred) return { key: preferred, source: 'Sent_API_Key' };
  const legacy = normalizeApiKey(Deno.env.get('SENT_DM_API_KEY'));
  return legacy ? { key: legacy, source: 'SENT_DM_API_KEY' } : { key: undefined, source: null };
}

export const sentApiKey = (): string | undefined => sentApiKeyInfo().key;
