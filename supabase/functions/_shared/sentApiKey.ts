/**
 * The Sent (sent.dm) API key from the Supabase secrets. The canonical name is
 * SENT_DM_API_KEY; the key was also stored as Sent_API_Key, and secret names are
 * case-sensitive, so either one is accepted.
 */
export function sentApiKey(): string | undefined {
  return Deno.env.get('SENT_DM_API_KEY')?.trim() || Deno.env.get('Sent_API_Key')?.trim() || undefined;
}
