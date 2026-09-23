import { supabase } from '../lib/supabase';

/**
 * Previewing and test-sending the emails an admin sends by hand from a client's
 * profile: the post-job follow-up, the quote, and the invoice.
 *
 * Every body here is rendered by the edge function that sends it — the same
 * code path that actually mails the client. The browser deliberately does not
 * build its own copy of any of these templates: a preview that drifts from what
 * sends is worse than no preview at all, and the whole point of one is to be
 * able to trust it.
 *
 * Sending each of these lives elsewhere (ClientDetailModal's own handlers, and
 * quoteEmailService), because sending carries cooldown handling that the
 * callers already own. Only the two read-only-for-the-client modes are here.
 */

export interface ClientEmailPreview {
  subject: string;
  /** The email body. Rendered into a sandboxed iframe, never injected. */
  html: string;
  text: string;
  /** The address a real send would go to, or null when there is not a usable one. */
  recipient: string | null;
  /** Why a real send would refuse right now, in words, or null when it would go. */
  blocked: string | null;
}

export interface TestSendResult {
  /** Where it actually went — the signed-in admin, never the client. */
  to: string | null;
}

/**
 * These functions are called with plain fetch rather than supabase.functions
 * .invoke on purpose. The Supabase client's fetch wrapper adds x-correlation-id
 * and x-session-correlation-id to every request, and these three functions do
 * not list those in Access-Control-Allow-Headers — the browser would reject the
 * preflight before the POST was ever sent, which surfaces as a generic "failed
 * to send a request" with nothing mentioning CORS.
 */
async function callEmailFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    throw new Error(json?.error || fallbackError);
  }

  return json as T;
}

async function loadPreview(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ClientEmailPreview> {
  const json = await callEmailFunction<{ preview?: ClientEmailPreview }>(
    functionName,
    { ...body, preview: true },
    'Could not load the preview.',
  );

  if (!json.preview) throw new Error('The email service returned no preview.');
  return json.preview;
}

/**
 * Mails the exact same email to the signed-in admin instead of the client. The
 * recipient is read from the caller's own token on the server, so there is no
 * address to pass and no way to aim this at anyone else. The client's own copy
 * is untouched and, where one was owed, still owed.
 */
async function sendTest(
  functionName: string,
  body: Record<string, unknown>,
): Promise<TestSendResult> {
  const json = await callEmailFunction<{ to?: string | null }>(
    functionName,
    { ...body, test: true },
    'The test send failed.',
  );

  return { to: json.to ?? null };
}

export function previewFollowupEmail(
  clientId: string,
  organizationId: string,
): Promise<ClientEmailPreview> {
  return loadPreview('send-followup-email', { clientId, organizationId });
}

export function sendFollowupEmailTest(
  clientId: string,
  organizationId: string,
): Promise<TestSendResult> {
  return sendTest('send-followup-email', { clientId, organizationId });
}

export function previewQuoteEmail(
  clientId: string,
  organizationId: string,
  jobId: string,
): Promise<ClientEmailPreview> {
  return loadPreview('send-quote-email', { clientId, organizationId, jobId });
}

export function sendQuoteEmailTest(
  clientId: string,
  organizationId: string,
  jobId: string,
): Promise<TestSendResult> {
  return sendTest('send-quote-email', { clientId, organizationId, jobId });
}

/**
 * overrideEmail only decides what the preview names as the recipient, for a
 * client with no address on file. The test send below omits it: a test goes to
 * the admin either way, and passing an address it cannot use would suggest
 * otherwise.
 */
export function previewInvoiceEmail(
  clientId: string,
  organizationId: string,
  invoiceId: string,
  overrideEmail?: string,
): Promise<ClientEmailPreview> {
  return loadPreview('send-invoice-email', {
    clientId,
    organizationId,
    invoiceId,
    ...(overrideEmail?.trim() ? { overrideEmail: overrideEmail.trim() } : {}),
  });
}

export function sendInvoiceEmailTest(
  clientId: string,
  organizationId: string,
  invoiceId: string,
): Promise<TestSendResult> {
  return sendTest('send-invoice-email', { clientId, organizationId, invoiceId });
}
