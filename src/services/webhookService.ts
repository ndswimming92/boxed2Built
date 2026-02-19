const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26506646/ucr92o4/';

type WebhookPayload = Record<string, unknown>;

interface WebhookOptions {
  formType: string;
  status: 'success' | 'error';
  payload: WebhookPayload;
}

/**
 * Send form submission events to Zapier webhook.
 * This is intentionally non-blocking for the UI flow.
 */
export async function sendFormWebhook({ formType, status, payload }: WebhookOptions): Promise<void> {
  try {
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        form_type: formType,
        submission_status: status,
        submitted_at: new Date().toISOString(),
        ...payload,
      }),
    });

    if (!response.ok) {
      console.error(`[Webhook] Failed to send ${formType} submission (${response.status})`);
    }
  } catch (error) {
    console.error('[Webhook] Error sending form webhook:', error);
  }
}
