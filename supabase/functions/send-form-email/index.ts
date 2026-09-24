import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Client Type</span></td>
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">We got your request!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Thanks for reaching out, ${firstName}. We'll be in touch shortly.</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">Your quote request has been received and saved. Here's a summary of what you submitted:</p>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 12px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Your Confirmation Code</p>
          <p style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1e3a5f;font-family:monospace;letter-spacing:2px;">${safeCode}</p>
          <p style="margin:0 0 14px;color:#6b7280;font-size:12px;">Keep this handy — you can use it to look up your request at any time.</p>
          <a href="https://boxed2built.com/lookup-request?code=${encodeURIComponent(p.confirmationCode)}&email=${encodeURIComponent(p.email)}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:6px;">View My Request &rarr;</a>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:40%;">Furniture Type</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${safeFurnitureType}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Pieces</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${p.pieces}</td>
          </tr>
          ${safeCity ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Service ZIP</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${safeCity}</td>
          </tr>` : ""}
          ${safeEstimatedPrice ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Estimated Cost</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#15803d;font-size:13px;font-weight:600;">${safeEstimatedPrice}</td>
          </tr>` : ""}
          ${safeCouponCode ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Coupon Applied</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#b45309;font-size:13px;font-weight:600;">${safeCouponCode}${safeCouponLabel ? ` &middot; ${safeCouponLabel}` : ""}</td>
          </tr>` : ""}
          ${safeEstimatedTime ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Estimated Time</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${safeEstimatedTime}</td>
          </tr>` : ""}
          ${p.preferredDate ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Preferred Date</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${formatDate(p.preferredDate)}</td>
          </tr>` : ""}
          ${p.preferredTimeSlot ? `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Preferred Time</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:13px;font-weight:500;">${formatTimeSlot(p.preferredTimeSlot)}</td>
          </tr>` : ""}
          ${safeNotes ? `<tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Notes</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:500;">${safeNotes}</td>
          </tr>` : ""}
        </table>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 16px;color:#111827;font-size:14px;font-weight:700;">What happens next</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-bottom:14px;width:32px;">
                <div style="width:24px;height:24px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:24px;color:#ffffff;font-size:12px;font-weight:700;">1</div>
              </td>
              <td style="vertical-align:top;padding-bottom:14px;padding-left:12px;">
                <p style="margin:0 0 2px;color:#111827;font-size:13px;font-weight:600;">We review your request</p>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Our team looks over your details and double-checks availability for your preferred date and time.</p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-bottom:14px;width:32px;">
                <div style="width:24px;height:24px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:24px;color:#ffffff;font-size:12px;font-weight:700;">2</div>
              </td>
              <td style="vertical-align:top;padding-bottom:14px;padding-left:12px;">
                <p style="margin:0 0 2px;color:#111827;font-size:13px;font-weight:600;">We reach out to confirm</p>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Expect a call or email from us within <strong>24 hours</strong> to lock in your appointment and finalize any details.</p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-bottom:14px;width:32px;">
                <div style="width:24px;height:24px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:24px;color:#ffffff;font-size:12px;font-weight:700;">3</div>
              </td>
              <td style="vertical-align:top;padding-bottom:14px;padding-left:12px;">
                <p style="margin:0 0 2px;color:#111827;font-size:13px;font-weight:600;">We arrive and get to work</p>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Our assembler shows up at your location on the scheduled day and handles everything start to finish.</p>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;width:32px;">
                <div style="width:24px;height:24px;background:#1e3a5f;border-radius:50%;text-align:center;line-height:24px;color:#ffffff;font-size:12px;font-weight:700;">4</div>
              </td>
              <td style="vertical-align:top;padding-left:12px;">
                <p style="margin:0 0 2px;color:#111827;font-size:13px;font-weight:600;">Pay only when the job is done</p>
                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">No upfront payment required. You pay after you're satisfied with the completed work.</p>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.7;">Questions in the meantime? Call us at <span style="color:#111827;font-weight:600;">(615) 403-4538</span> or <a href="https://boxed2built.com/lookup-request?code=${encodeURIComponent(p.confirmationCode)}&email=${encodeURIComponent(p.email)}" style="color:#1d4ed8;">look up your request online</a>.</p>

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
        console.error("Client confirmation email failed:", msg);
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
        console.error("Client confirmation email failed:", msg);
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
