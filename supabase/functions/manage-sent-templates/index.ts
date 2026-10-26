import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  type TemplateCategory,
  type TemplateVariable,
  buildSentPayload,
  validateTemplate,
} from '../_shared/sentTemplates.ts';

/**
 * Backs Admin > SMS Templates. The page keeps the wording as a draft in the
 * browser; this function is what actually talks to Sent, so the API key never
 * reaches the browser.
 *
 *   POST { action: 'submit', name, secret_name, category, body, variables }
 *        creates the template in Sent, submits it for review and records it.
 *   POST { action: 'refresh' }
 *        asks Sent for the current review status of every recorded template.
 *
 * Both answer { keyMode, templates } so the page can warn when the key is
 * still a test key. Uses SENT_DM_API_KEY, the same secret the texting code
 * uses. Platform admins only.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SENT_TEMPLATES_URL = 'https://api.sent.dm/v3/templates';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const sentHeaders = (apiKey: string) => ({ 'x-api-key': apiKey, 'Content-Type': 'application/json' });

/** What Sent said went wrong, short enough to show in the page. */
function describeError(body: unknown, status: number): string {
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  if (error?.message) return `Sent refused it (${error.code ?? status}): ${error.message}`;
  return `Sent refused it (HTTP ${status}).`;
}

const keyMode = (apiKey: string | undefined) =>
  !apiKey ? 'missing' : apiKey.startsWith('sk_live_') ? 'live' : apiKey.startsWith('sk_test_') ? 'test' : 'unknown';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) return json({ success: false, error: auth.error }, auth.status ?? 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const apiKey = Deno.env.get('SENT_DM_API_KEY')?.trim();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const listTemplates = async () => {
    const { data, error } = await admin
      .from('sms_templates')
      .select('id, created_at, secret_name, name, category, body, variables, sent_template_id, sent_status, status_checked_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not read saved templates: ${error.message}`);
    return data ?? [];
  };

  try {
    if (body.action === 'submit') {
      if (!apiKey) return json({ success: false, error: 'SENT_DM_API_KEY is not set in Supabase secrets.' }, 400);

      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
      const category: TemplateCategory | null =
        body.category === 'UTILITY' || body.category === 'MARKETING' ? body.category : null;
      const secretName = typeof body.secret_name === 'string' && /^SENT_TEMPLATE_[A-Z_]+$/.test(body.secret_name)
        ? body.secret_name
        : null;
      const variables: TemplateVariable[] = Array.isArray(body.variables)
        ? (body.variables as Record<string, unknown>[]).map((v) => ({
            id: Number(v.id),
            name: String(v.name ?? ''),
            variableType: v.variableType === 'link' ? 'link' : 'text',
            sample: String(v.sample ?? ''),
          }))
        : [];

      if (!name) return json({ success: false, error: 'Give the template a name.' }, 400);
      if (!category) return json({ success: false, error: 'Pick a category.' }, 400);

      const draft = { secret: secretName, category, body: typeof body.body === 'string' ? body.body : '', variables };
      const problems = validateTemplate(draft);
      if (problems.length) return json({ success: false, error: problems.join(' '), problems }, 400);

      const response = await fetch(SENT_TEMPLATES_URL, {
        method: 'POST',
        headers: sentHeaders(apiKey),
        body: JSON.stringify(buildSentPayload(draft)),
      });
      const result = await response.json().catch(() => null);
      const sentId: string | undefined = result?.data?.id ?? result?.data?.template_id;
      if (!response.ok || !sentId) {
        console.error('[manage-sent-templates] create failed', response.status, JSON.stringify(result?.error ?? result));
        return json({ success: false, error: describeError(result, response.status) }, 502);
      }

      const { error: insertError } = await admin.from('sms_templates').insert({
        submitted_by: auth.user?.email ?? null,
        secret_name: secretName,
        name,
        category,
        body: draft.body.trim(),
        variables,
        sent_template_id: String(sentId),
        sent_status: result?.data?.status ?? 'submitted',
        status_checked_at: new Date().toISOString(),
      });
      // Sent already has the template, so a failed save must not look like a failed submit.
      if (insertError) console.error('[manage-sent-templates] could not record template', sentId, insertError.message);

      return json({
        success: true,
        sent_template_id: String(sentId),
        secret_name: secretName,
        recorded: !insertError,
        keyMode: keyMode(apiKey),
        templates: await listTemplates(),
      });
    }

    if (body.action === 'refresh') {
      let templates = await listTemplates();
      let refreshError: string | null = null;

      if (apiKey) {
        await Promise.all(
          templates.map(async (t) => {
            try {
              const response = await fetch(`${SENT_TEMPLATES_URL}/${encodeURIComponent(t.sent_template_id)}`, {
                headers: sentHeaders(apiKey),
              });
              const result = await response.json().catch(() => null);
              if (!response.ok) {
                refreshError = describeError(result, response.status);
                return;
              }
              const status = result?.data?.status;
              if (typeof status === 'string') {
                await admin
                  .from('sms_templates')
                  .update({ sent_status: status, status_checked_at: new Date().toISOString() })
                  .eq('id', t.id);
              }
            } catch (err) {
              refreshError = err instanceof Error ? err.message : 'Could not reach Sent.';
            }
          }),
        );
        templates = await listTemplates();
      }

      return json({ success: true, keyMode: keyMode(apiKey), refreshError, templates });
    }

    return json({ success: false, error: 'Unsupported action' }, 400);
  } catch (err) {
    console.error('[manage-sent-templates]', err);
    return json({ success: false, error: err instanceof Error ? err.message : 'Something went wrong.' }, 500);
  }
});
