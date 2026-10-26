import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "team@boxed2built.com";
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = "replies@reply.boxed2built.com";

/**
 * Every address that should receive a new lead.
 *
 * Resend blocks the WHOLE message when any single recipient is suppressed — the
 * healthy addresses on the same email get nothing. So one dead address here
 * silently kills the notification for everyone.
 *
 * That is not hypothetical. team@boxed2built.com hard-bounced on 8 July, was
 * auto-suppressed, and sat in this list until 21 September. Eleven lead
 * notifications were dropped in that window, every one of them addressed to a
 * working mailbox as well:
 *
 *     To:     nicholas.davidson@boxed2built.com, team@boxed2built.com
 *     Status: suppressed
 *
 * Nothing surfaced it — the function logs success because the Resend API call
 * itself returns 200. Only add an address here that is known to accept mail,
 * and check https://resend.com/suppressions before adding one back.
 */
const OWNER_RECIPIENTS = ["nicholas.davidson@boxed2built.com"];

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface ContactFormPayload {
  formType: "contact";
  name: string;
  email: string;
  phone?: string;
  userCity?: string;
  furnitureType: string;
  pieces: number;
  preferredDate?: string;
  preferredTimeSlot?: string;
  notes?: string;
  estimatedPrice?: string;
  estimatedTime?: string;
  confirmationCode: string;
  isTest?: boolean;
  furniturePhotoUrl?: string;
  furnitureImagePath?: string;
  referralCodeUsed?: string;
  referrerName?: string;
  clientType?: string;
  // Present when a coupon was applied. estimatedPrice already has the discount
  // taken off; these describe where the difference went.
  couponCode?: string;
  couponDiscountLabel?: string;
  // False when the SMS checkboxes were switched off in admin, so the form
  // never showed them. Distinguishes "not offered" from "declined".
  smsOptInEnabled?: boolean;
  smsServiceOptIn?: boolean;
  smsMarketingOptIn?: boolean;
  smsConsentTimestamp?: string;
}

interface QuickContactPayload {
  formType: "quick_contact";
  name: string;
  email: string;
  message: string;
  isTest?: boolean;
}

type Payload = ContactFormPayload | QuickContactPayload;

async function sendEmail(to: string | string[], subject: string, html: string, replyTo?: string) {
  const toArray = Array.isArray(to) ? to : [to];
  const body: Record<string, unknown> = {
    from: `Boxed2Built <${FROM_EMAIL}>`,
    to: toArray,
    subject,
    html,
  };
  if (replyTo) {
    body.reply_to = replyTo;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${err}`);
  }
  return await res.json();
}

function formatTimeSlot(slot?: string): string {
  if (!slot) return "No preference";
  const map: Record<string, string> = {
    morning: "Morning (9 AM – 12 PM)",
    afternoon: "Afternoon (12 PM – 5 PM)",
    evening: "Evening (5 PM – 8 PM)",
    weekend: "Weekend preferred",
  };
  return map[slot] ?? slot;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Not specified";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function smsOptInSection(p: ContactFormPayload): string {
  const label = "color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;";
  const choice = (text: string, optedIn: boolean) => `<tr>
        <td style="padding:4px 0;color:#111827;font-size:14px;">${text}</td>
        <td style="padding:4px 0;text-align:right;font-size:14px;font-weight:700;color:${optedIn ? "#15803d" : "#b91c1c"};">${optedIn ? "&#10003; Opted in" : "&#10007; Not opted in"}</td>
      </tr>`;
  let body: string;
  if (p.smsOptInEnabled === false) {
    body = `<span style="color:#6b7280;font-size:13px;">SMS opt-in was not offered on the form.</span>`;
  } else if (p.smsOptInEnabled === undefined && p.smsServiceOptIn === undefined && p.smsMarketingOptIn === undefined) {
    body = `<span style="color:#6b7280;font-size:13px;">No SMS opt-in data recorded.</span>`;
  } else {
    let when = "";
    if (p.smsConsentTimestamp) {
      const stamp = new Date(p.smsConsentTimestamp).toLocaleString("en-US", { timeZone: "America/Chicago" });
      when = `<div style="color:#6b7280;font-size:12px;margin-top:6px;">Consent recorded ${escapeHtml(stamp)} CT</div>`;
    }
    body = `<table width="100%" cellpadding="0" cellspacing="0">
      ${choice("Service texts (booking &amp; job updates)", p.smsServiceOptIn === true)}
      ${choice("Promotional texts (offers &amp; deals)", p.smsMarketingOptIn === true)}
    </table>${when}`;
  }
  return `<tr>
            <td colspan="2" style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
              <span style="${label}display:block;margin-bottom:6px;">SMS Opt-In</span>
              ${body}
            </td>
          </tr>`;
}

function ownerNotificationContact(p: ContactFormPayload): string {
  const testBadge = p.isTest ? `<div style="background:#fef08a;border:1px solid #ca8a04;color:#713f12;padding:8px 12px;border-radius:6px;margin-bottom:16px;font-size:13px;font-weight:600;">TEST SUBMISSION — No action required</div>` : "";
  const safeName = escapeHtml(p.name);
  const safeEmail = escapeHtml(p.email);
  const safePhone = p.phone ? escapeHtml(p.phone) : null;
  const safeCity = p.userCity ? escapeHtml(p.userCity) : null;
  const safeCode = escapeHtml(p.confirmationCode);
  const safeFurnitureType = escapeHtml(p.furnitureType);
  const safeEstimatedPrice = p.estimatedPrice ? escapeHtml(p.estimatedPrice) : null;
  const safeEstimatedTime = p.estimatedTime ? escapeHtml(p.estimatedTime) : null;
  const safeNotes = p.notes ? escapeHtml(p.notes) : null;
  const safeReferralCode = p.referralCodeUsed ? escapeHtml(p.referralCodeUsed) : null;
  const safeCouponCode = p.couponCode ? escapeHtml(p.couponCode) : null;
  const safeCouponLabel = p.couponDiscountLabel ? escapeHtml(p.couponDiscountLabel) : null;
  const safeReferrerName = p.referrerName ? escapeHtml(p.referrerName) : null;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">New Quote Request</h1>
        <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">Boxed2Built — Contact Form Submission</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:28px 32px;">
        ${testBadge}
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Confirmation Code</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#1e3a5f;font-size:14px;font-weight:700;font-family:monospace;">${safeCode}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Name</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safeName}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Email</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><a href="mailto:${safeEmail}" style="color:#1d4ed8;font-size:14px;">${safeEmail}</a></td>
          </tr>
          ${safePhone ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Phone</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safePhone}</span></td>
          </tr>` : ""}
          ${safeCity ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Service ZIP</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safeCity}</span></td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Customer Type</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;font-weight:600;${p.clientType === 'business' ? 'color:#0369a1;' : ''}">${p.clientType === 'business' ? '🏢 Business' : '🏠 Residential'}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Furniture Type</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safeFurnitureType}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Pieces</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${p.pieces}</span></td>
          </tr>
          ${safeEstimatedPrice ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Est. Price</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#15803d;font-size:14px;font-weight:600;">${safeEstimatedPrice}</span></td>
          </tr>` : ""}
          ${safeCouponCode ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Coupon</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#b45309;font-size:14px;font-weight:600;font-family:monospace;">${safeCouponCode}</span>${safeCouponLabel ? `<span style="color:#6b7280;font-size:12px;"> &middot; ${safeCouponLabel}</span>` : ""}</td>
          </tr>` : ""}
          ${safeEstimatedTime ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Est. Time</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safeEstimatedTime}</span></td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Preferred Date</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${formatDate(p.preferredDate)}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Preferred Time</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${formatTimeSlot(p.preferredTimeSlot)}</span></td>
          </tr>
          ${safeNotes ? `<tr>
            <td colspan="2" style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
              <span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">Notes</span>
              <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #1e3a5f;">${safeNotes}</p>
            </td>
          </tr>` : ""}
          ${p.furniturePhotoUrl ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Product Link</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><a href="${escapeHtml(p.furniturePhotoUrl)}" style="color:#1d4ed8;font-size:14px;word-break:break-all;" target="_blank">View Product</a></td>
          </tr>` : ""}
          ${p.furnitureImagePath ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Uploaded Photo</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><a href="${escapeHtml(Deno.env.get("SUPABASE_URL") ?? "")}/storage/v1/object/public/furniture-photos/${escapeHtml(p.furnitureImagePath)}" style="color:#1d4ed8;font-size:14px;" target="_blank">View Photo</a></td>
          </tr>` : ""}
          ${smsOptInSection(p)}
          ${safeReferralCode ? `<tr>
            <td colspan="2" style="padding:12px 0;">
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px 14px;">
                <span style="color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">Referral Code Used</span>
                <span style="color:#166534;font-size:15px;font-weight:800;font-family:monospace;">${safeReferralCode}</span>
                ${safeReferrerName ? `<span style="color:#15803d;font-size:13px;display:block;margin-top:4px;">Referred by: ${safeReferrerName}</span>` : `<span style="color:#6b7280;font-size:13px;display:block;margin-top:4px;">Referrer not found in system</span>`}
              </div>
            </td>
          </tr>` : `<tr>
            <td colspan="2" style="padding:10px 0;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;">
                <span style="color:#9ca3af;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Referral Code</span>
                <span style="color:#6b7280;font-size:13px;display:block;margin-top:2px;">None entered</span>
              </div>
            </td>
          </tr>`}
        </table>
        <div style="margin-top:20px;text-align:center;">
          <a href="https://boxed2built.com/lookup-request?code=${encodeURIComponent(p.confirmationCode)}&email=${encodeURIComponent(p.email)}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:6px;">View Full Request &rarr;</a>
        </div>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Submitted via boxed2built.com contact form &bull; ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function customerConfirmationContact(p: ContactFormPayload): string {
  const firstName = escapeHtml(p.name.split(" ")[0] || "there");
  const safeCode = escapeHtml(p.confirmationCode);
  const safeFurnitureType = escapeHtml(p.furnitureType);
  const safeCity = p.userCity ? escapeHtml(p.userCity) : null;
  const safeEstimatedPrice = p.estimatedPrice ? escapeHtml(p.estimatedPrice) : null;
  const safeEstimatedTime = p.estimatedTime ? escapeHtml(p.estimatedTime) : null;
  const safeNotes = p.notes ? escapeHtml(p.notes) : null;
  const safeCouponCode = p.couponCode ? escapeHtml(p.couponCode) : null;
  const safeCouponLabel = p.couponDiscountLabel ? escapeHtml(p.couponDiscountLabel) : null;
  const lookupUrl = `https://boxed2built.com/lookup-request?code=${encodeURIComponent(p.confirmationCode)}&email=${encodeURIComponent(p.email)}`;

  // Brand palette (matches the homepage hero): navy ground, gold accents.
  const NAVY = "#0E2748";
  const NAVY_CARD = "#152F55";
  const NAVY_LINE = "#25406B";
  const GOLD = "#D9A441";
  const MUTED = "#C3CCE0";
  const LABEL = "#9FB0CC";
  const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const row = (label: string, value: string, valueStyle = `color:#ffffff;font-weight:600;`) => `<tr>
            <td style="padding:12px 0;border-bottom:1px solid ${NAVY_LINE};color:${LABEL};font-size:14px;width:42%;vertical-align:top;">${label}</td>
            <td style="padding:12px 0;border-bottom:1px solid ${NAVY_LINE};font-size:14px;text-align:right;${valueStyle}">${value}</td>
          </tr>`;

  const step = (n: number, title: string, body: string, last = false) => `<tr>
              <td style="vertical-align:top;width:40px;${last ? "" : "padding-bottom:18px;"}">
                <div style="width:30px;height:30px;background:${GOLD};border-radius:8px;text-align:center;line-height:30px;color:${NAVY};font-size:15px;font-weight:800;">${n}</div>
              </td>
              <td style="vertical-align:top;padding-left:12px;${last ? "" : "padding-bottom:18px;"}">
                <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">${title}</p>
                <p style="margin:0;color:${MUTED};font-size:13px;line-height:1.55;">${body}</p>
              </td>
            </tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${NAVY};font-family:${FONT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY}" style="background:${NAVY};padding:28px 12px 36px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

      <tr><td style="padding:0 12px 28px;text-align:center;">
        <a href="https://boxed2built.com" style="text-decoration:none;display:inline-block;"><img src="https://boxed2built.com/boxed2built_logo_email.png" width="96" height="96" alt="Boxed2Built" style="display:block;width:96px;height:96px;border:0;outline:none;color:#ffffff;font-size:20px;font-weight:800;"></a>
      </td></tr>

      <tr><td style="padding:0 12px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;">We got your request!</h1>
        <div style="width:56px;height:4px;background:${GOLD};border-radius:4px;margin:16px auto 0;font-size:0;line-height:0;">&nbsp;</div>
        <p style="margin:18px 0 0;color:${MUTED};font-size:16px;line-height:1.6;">Thanks for reaching out, <strong style="color:#ffffff;">${firstName}</strong>. Your quote request is saved, and we'll be in touch shortly.</p>
      </td></tr>

      <tr><td style="padding:32px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${GOLD}" style="background:${GOLD};border-radius:16px;">
          <tr><td style="padding:26px 24px;text-align:center;">
            <p style="margin:0 0 10px;color:${NAVY};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:3px;">Your Confirmation Code</p>
            <p style="margin:0 0 8px;color:${NAVY};font-size:30px;font-weight:800;font-family:'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:3px;word-break:break-all;">${safeCode}</p>
            <p style="margin:0 0 20px;color:${NAVY};font-size:13px;line-height:1.5;opacity:.8;">Keep this handy — use it to look up your request any time.</p>
            <a href="${lookupUrl}" style="display:inline-block;background:${NAVY};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">View My Request &rarr;</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY_CARD}" style="background:${NAVY_CARD};border-radius:16px;">
          <tr><td style="padding:22px 24px 10px;">
            <p style="margin:0 0 6px;color:${GOLD};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:3px;">Your Request</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${row("Furniture Type", safeFurnitureType)}
          ${row("Pieces", String(p.pieces))}
          ${safeCity ? row("Service ZIP", safeCity) : ""}
          ${safeEstimatedPrice ? row("Estimated Cost", safeEstimatedPrice, `color:${GOLD};font-weight:800;font-size:17px;`) : ""}
          ${safeCouponCode ? row("Coupon Applied", `${safeCouponCode}${safeCouponLabel ? ` &middot; ${safeCouponLabel}` : ""}`, `color:${GOLD};font-weight:700;`) : ""}
          ${safeEstimatedTime ? row("Estimated Time", safeEstimatedTime) : ""}
          ${p.preferredDate ? row("Preferred Date", formatDate(p.preferredDate)) : ""}
          ${p.preferredTimeSlot ? row("Preferred Time", formatTimeSlot(p.preferredTimeSlot)) : ""}
          ${safeNotes ? `<tr><td colspan="2" style="padding:14px 0 6px;">
              <p style="margin:0 0 6px;color:${LABEL};font-size:14px;">Notes</p>
              <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">${safeNotes}</p>
            </td></tr>` : ""}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY_CARD}" style="background:${NAVY_CARD};border-radius:16px;">
          <tr><td style="padding:22px 24px;">
            <p style="margin:0 0 18px;color:${GOLD};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:3px;">What Happens Next</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${step(1, "We review your request", "We look over your details and double-check availability for your preferred date and time.")}
            ${step(2, "We reach out to confirm", `Expect a call or email from us within <strong style="color:#ffffff;">24 hours</strong> to lock in your appointment and finalize any details.`)}
            ${step(3, "We arrive and get to work", "Your assembler shows up on the scheduled day and handles everything start to finish.")}
            ${step(4, "Pay only when the job is done", "No upfront payment required. You pay after you're happy with the finished work.", true)}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px 12px 0;text-align:center;">
        <p style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:600;font-style:italic;line-height:1.5;">Turning boxes into comfort so families can focus on what matters most.</p>
        <p style="margin:14px 0 18px;color:${MUTED};font-size:15px;line-height:1.6;">Questions in the meantime? We're happy to help.</p>
        <a href="tel:+16154034538" style="display:inline-block;background:${GOLD};color:${NAVY};font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">Call (615) 403-4538</a>
        <p style="margin:22px 0 0;color:#ffffff;font-size:15px;">— The Boxed2Built Team</p>
      </td></tr>

      <tr><td style="padding:32px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${NAVY_LINE};">
          <tr>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">&#9733; 5-Star Rated</td>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">No Payment Until Done</td>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">Locally Owned</td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:${LABEL};font-size:12px;text-align:center;">Boxed2Built &bull; Spring Hill, TN &bull; <a href="https://boxed2built.com" style="color:${LABEL};">boxed2built.com</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function ownerNotificationQuick(p: QuickContactPayload): string {
  const testBadge = p.isTest ? `<div style="background:#fef08a;border:1px solid #ca8a04;color:#713f12;padding:8px 12px;border-radius:6px;margin-bottom:16px;font-size:13px;font-weight:600;">TEST SUBMISSION — No action required</div>` : "";
  const safeName = escapeHtml(p.name);
  const safeEmail = escapeHtml(p.email);
  const safeMessage = escapeHtml(p.message);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Quick Contact Message</h1>
        <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">Boxed2Built — Footer Quick Contact Form</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:28px 32px;">
        ${testBadge}
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Name</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span style="color:#111827;font-size:14px;">${safeName}</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Email</span></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><a href="mailto:${safeEmail}" style="color:#1d4ed8;font-size:14px;">${safeEmail}</a></td>
          </tr>
          <tr>
            <td colspan="2" style="padding:12px 0;">
              <span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">Message</span>
              <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #1e3a5f;">${safeMessage}</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Submitted via boxed2built.com quick contact form &bull; ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function customerConfirmationQuick(p: QuickContactPayload): string {
  const firstName = escapeHtml(p.name.split(" ")[0] || "there");
  const safeMessage = escapeHtml(p.message);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Message received!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Thanks for reaching out, ${firstName}.</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">We've received your message and will get back to you within <strong>24 hours</strong>.</p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Your message</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;font-style:italic;">&ldquo;${safeMessage}&rdquo;</p>
        </div>

        <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.7;">Need a faster response? Call us at <span style="color:#111827;font-weight:600;">(615) 403-4538</span>.</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">If you're ready for a free quote, you can also <a href="https://boxed2built.com/#contact" style="color:#1d4ed8;">fill out our full request form</a>.</p>

        <p style="margin:0;color:#374151;font-size:15px;">— The Boxed2Built Team</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Boxed2Built &bull; Spring Hill, TN &bull; <a href="https://boxed2built.com" style="color:#9ca3af;">boxed2built.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  ipKey: string,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  try {
    const { count } = await supabase
      .from("admin_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "form_submission_rate_limit_check")
      .eq("entity_type", "ip")
      .eq("entity_id", ipKey)
      .gte("created_at", windowStart);
    return (count ?? 0) < RATE_LIMIT_MAX;
  } catch {
    return true;
  }
}

async function recordSubmission(
  supabase: ReturnType<typeof createClient>,
  ipKey: string,
): Promise<void> {
  try {
    await supabase.from("admin_audit_logs").insert({
      action: "form_submission_rate_limit_check",
      entity_type: "ip",
      entity_id: ipKey,
      details: {},
    });
  } catch {
    // non-fatal
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const ipKey = (
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"
    ).split(",")[0].trim();

    const rateLimitSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const allowed = await checkRateLimit(rateLimitSupabase, ipKey);
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await recordSubmission(rateLimitSupabase, ipKey);

    const payload: Payload = await req.json();

    const emailResults: { owner: boolean; client: boolean; clientError?: string } = {
      owner: false,
      client: false,
    };

    if (payload.formType === "contact") {
      const p = payload as ContactFormPayload;
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (p.referralCodeUsed) {
        try {
          const { data: referrer } = await supabase
            .from("clients")
            .select("name")
            .eq("referral_code", p.referralCodeUsed)
            .maybeSingle();
          if (referrer?.name) {
            p.referrerName = referrer.name;
          }
        } catch (err) {
          console.error("Referrer lookup failed:", err);
        }
      }

      try {
        await sendEmail(
          OWNER_RECIPIENTS,
          `New Quote Request — ${p.name} (${p.furnitureType}, ${p.pieces} pc${p.pieces !== 1 ? "s" : ""})`,
          ownerNotificationContact(p),
          p.email
        );
        emailResults.owner = true;
      } catch (err) {
        console.error("Owner notification email failed:", err);
      }

      try {
        await sendEmail(
          p.email,
          `Your Boxed2Built request is confirmed — Code: ${p.confirmationCode}`,
          customerConfirmationContact(p),
          REPLY_TO_EMAIL
        );
        emailResults.client = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Customer confirmation email failed:", msg);
        emailResults.clientError = msg;
      }
    } else if (payload.formType === "quick_contact") {
      const p = payload as QuickContactPayload;

      try {
        await sendEmail(
          OWNER_RECIPIENTS,
          `Quick Contact from ${p.name}`,
          ownerNotificationQuick(p),
          p.email
        );
        emailResults.owner = true;
      } catch (err) {
        console.error("Owner notification email failed:", err);
      }

      try {
        await sendEmail(
          p.email,
          "We received your message — Boxed2Built",
          customerConfirmationQuick(p),
          REPLY_TO_EMAIL
        );
        emailResults.client = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Customer confirmation email failed:", msg);
        emailResults.clientError = msg;
      }
    } else {
      throw new Error("Invalid formType");
    }

    return new Response(JSON.stringify({ success: true, emailResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-form-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
