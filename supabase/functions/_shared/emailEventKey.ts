/**
 * The idempotency key for a Resend webhook event, stored in
 * email_events.resend_event_id (a unique column).
 *
 * Resend payloads carry no top-level `id`, and the old key fell back to
 * `data.email_id`. That ID is shared by every event for one email, so the
 * first event stored (usually "sent") made every later one (delivered,
 * opened, clicked, bounced, complained) look like a duplicate and get dropped.
 *
 * The `svix-id` header is unique per event and identical on each retry of it,
 * which is exactly what an idempotency key needs. The fallback carries the
 * event type so that, even without the header, two different events for one
 * email can never share a key.
 *
 * Kept free of Deno APIs so `node --test` can import it.
 */
export function resendEventKey(
  svixId: string | null | undefined,
  eventType: string,
  emailId: string | null | undefined,
): string | null {
  const id = svixId?.trim();
  if (id) return id;
  if (emailId) return `${eventType}:${emailId}`;
  return null;
}
