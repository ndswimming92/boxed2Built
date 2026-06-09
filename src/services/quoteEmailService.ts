import { supabase } from '../lib/supabase';

interface SendQuoteEmailResult {
  success: boolean;
  sentAt?: string;
  error?: string;
  remainingSeconds?: number;
}

export async function sendQuoteEmail(
  clientId: string,
  organizationId: string,
  jobId: string,
): Promise<SendQuoteEmailResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/send-quote-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ clientId, organizationId, jobId }),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    return {
      success: false,
      error: json.error ?? 'Failed to send quote email.',
      remainingSeconds: json.remainingSeconds,
    };
  }

  return { success: true, sentAt: json.sentAt };
}
