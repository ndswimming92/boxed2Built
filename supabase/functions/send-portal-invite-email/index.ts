import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';

// Built here on a fixed origin and never taken from the request body, so a
// caller cannot make the business's sending domain mail an arbitrary URL.
const APP_URL = 'https://www.boxed2built.com';

// An invite is not a nudge. Ten minutes is right for a follow-up someone asked
// for twice; a second portal invite the same day reads as spam to the customer.
const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

interface Payload {
  clientId?: string;
  organizationId?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildInviteEmailHtml(linkUrl: string, clientName: string): string {
  const safeUrl = escapeHtml(linkUrl);
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your Boxed2Built client portal is ready</h1>
                <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Track your jobs, invoices and documents in one place.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">We've set up portal access for you. Your existing job history, invoices and documents are already waiting inside — there is nothing to fill in.</p>
                <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">Click below to sign in. No password needed.</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Open My Client Portal</a>
                </p>
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">This link is single-use and expires shortly. If it stops working, you can always sign in at <a href="${APP_URL}/portal/login" style="color:#2563eb;">${APP_URL}/portal/login</a> and we'll email you a fresh one.</p>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you weren't expecting this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildInvitePlainText(linkUrl: string, clientName: string): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';

  return [
    `Hi ${firstName},`,
    '',
    "We've set up portal access for you. Your existing job history, invoices and documents are already waiting inside.",
    '',
    'Sign in here (no password needed):',
    linkUrl,
    '',
    `This link is single-use and expires shortly. If it stops working, go to ${APP_URL}/portal/login and we'll email you a fresh one.`,
    '',
    "If you weren't expecting this, you can safely ignore this email.",
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ success: false, error: 'Email service is not configured.' }, 500);
  }

  try {
    // Inviting someone into the portal is a staff action. The published anon key
    // is itself a valid JWT, so verify_jwt alone would leave this open.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return json({ success: false, error: auth.error }, auth.status ?? 401);
    }

    const body = (await req.json()) as Payload;
    if (!body?.clientId || !body?.organizationId) {
      return json({ success: false, error: 'Missing required fields.' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, last_portal_invite_sent_at')
      .eq('id', body.clientId)
      .eq('organization_id', body.organizationId)
      .maybeSingle();

    if (clientError || !client) {
      return json({ success: false, error: 'Client not found.' }, 404);
    }

    if (!client.email) {
      return json({ success: false, error: 'Client has no email address.' }, 422);
    }

    if (client.last_portal_invite_sent_at) {
      const elapsed = Date.now() - new Date(client.last_portal_invite_sent_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        return json(
          {
            success: false,
            error: 'cooldown',
            remainingSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
          },
          429,
        );
      }
    }

    const email = client.email.trim().toLowerCase();
    const redirectTo = `${APP_URL}/portal/callback?flow=magic_link&next=%2Fportal%2Fdashboard`;

    // generateLink rather than signInWithOtp on purpose. It registers no PKCE
    // challenge, so the resulting link works in whatever browser the customer
    // opens their mail in — which for an email an admin sends is usually a
    // phone, and is exactly the case self-serve magic links cannot handle. It
    // also sends through Resend rather than Supabase Auth, so it is not subject
    // to the Auth email rate limits.
    //
    // 'magiclink' requires the auth user to already exist and 'invite' requires
    // it not to, and there is no way to know which from here, so try and fall
    // back. Seeding full_name matters: runPortalPostLogin reads
    // user_metadata.full_name and passes it to auto_create_portal_customer,
    // which otherwise names the customer after the local part of their address.
    let actionLink: string | null = null;

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (linkError) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo, data: { full_name: client.name } },
      });

      if (inviteError) {
        console.error('generateLink failed for both magiclink and invite:', linkError, inviteError);
        return json({ success: false, error: 'Could not create a sign-in link for this address.' }, 500);
      }

      actionLink = inviteData?.properties?.action_link ?? null;
    } else {
      actionLink = linkData?.properties?.action_link ?? null;
    }

    if (!actionLink) {
      return json({ success: false, error: 'Could not create a sign-in link for this address.' }, 500);
    }

    const subject = 'Your Boxed2Built client portal is ready';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [email],
        subject,
        html: buildInviteEmailHtml(actionLink, client.name ?? ''),
        text: buildInvitePlainText(actionLink, client.name ?? ''),
        reply_to: FROM_EMAIL,
      }),
    });

    if (!resendRes.ok) {
      // Logged server-side only; the upstream body is never relayed to the caller.
      const err = await resendRes.text();
      console.error('Resend API error:', err);
      throw new Error('EMAIL_SEND_FAILED');
    }

    const resendData = await resendRes.json();
    const messageId: string = resendData?.id ?? '';
    const now = new Date().toISOString();

    // Two records, because they answer different questions. The client column
    // gates resends and drives the admin badge; customers.invited_at is what
    // portal_adoption_report and portal_inactive_customers_report already read
    // to report the 'invite_sent' funnel stage — nothing wrote it until now.
    await supabase.from('clients').update({ last_portal_invite_sent_at: now }).eq('id', client.id);

    await supabase
      .from('customers')
      .update({ invited_at: now })
      .eq('organization_id', body.organizationId)
      .ilike('email', email);

    await supabase.from('email_events').insert({
      resend_event_id: messageId ? `send-${messageId}` : null,
      message_id: messageId || null,
      event_type: 'email.sent',
      recipient: email,
      subject,
      from_address: FROM_EMAIL,
      occurred_at: now,
      payload: { source: 'send-portal-invite-email', clientId: client.id, clientName: client.name },
    });

    // The link itself is never returned — only that one was sent.
    return json({ success: true, sentAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send portal invite.';
    console.error('send-portal-invite-email error:', error);
    return json({ success: false, error: message }, 500);
  }
});
