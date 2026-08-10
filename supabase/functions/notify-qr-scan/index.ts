import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "team@boxed2built.com";
const DEFAULT_NOTIFY_EMAIL = Deno.env.get("QR_SCAN_NOTIFY_EMAIL") ?? "nicholas.davidson@boxed2built.com";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://boxed2built.com";

// Safety valve, not a policy: one email per scan is the intent, but this
// endpoint is public, so a code being hammered can't flood the inbox without
// limit. Set QR_SCAN_NOTIFY_MAX_PER_HOUR=0 to remove the cap entirely.
const MAX_EMAILS_PER_HOUR = Number(Deno.env.get("QR_SCAN_NOTIFY_MAX_PER_HOUR") ?? "60");

// Optional: set IPINFO_TOKEN to resolve city/region/country from the IP.
// Without it we fall back to whatever geo headers the edge network provides.
const IPINFO_TOKEN = Deno.env.get("IPINFO_TOKEN");

interface ScanPayload {
  slug?: string;
  qrCodeId?: string;
  destinationUrl?: string;
  referrer?: string;
  pageUrl?: string;
  userAgent?: string;
  timezone?: string;
  language?: string;
  screenResolution?: string;
  deviceModel?: string;
  osVersion?: string;
  browserVersion?: string;
}

interface ParsedUserAgent {
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  is_bot: boolean;
}

interface ResolvedGeo {
  country: string;
  region: string;
  city: string;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slackbot|discord|skypeuripreview|twitterbot|linkedinbot|embedly|preview|headless|monitor|pingdom|curl\/|wget|python-requests|axios\/|postman/i;

function firstMatch(ua: string, pattern: RegExp): string {
  const match = ua.match(pattern);
  return match?.[1]?.replace(/_/g, ".") ?? "";
}

function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();

  let device_type = "desktop";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    device_type = "tablet";
  } else if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    device_type = "mobile";
  }

  // Order matters: Edge and Opera both advertise Chrome, Chrome advertises Safari.
  let browser = "Unknown";
  let browser_version = "";
  if (ua.includes("firefox")) {
    browser = "Firefox";
    browser_version = firstMatch(ua, /firefox\/([\d.]+)/);
  } else if (ua.includes("edg")) {
    browser = "Edge";
    browser_version = firstMatch(ua, /edg(?:e|a|ios)?\/([\d.]+)/);
  } else if (ua.includes("opr") || ua.includes("opera")) {
    browser = "Opera";
    browser_version = firstMatch(ua, /(?:opr|opera)\/([\d.]+)/);
  } else if (ua.includes("chrome") || ua.includes("crios")) {
    browser = "Chrome";
    browser_version = firstMatch(ua, /(?:chrome|crios)\/([\d.]+)/);
  } else if (ua.includes("safari")) {
    browser = "Safari";
    browser_version = firstMatch(ua, /version\/([\d.]+)/);
  }

  // iOS/iPadOS must be checked before "mac" — they carry "like Mac OS X".
  let os = "Unknown";
  let os_version = "";
  if (/iphone|ipad|ipod/.test(ua)) {
    os = "iOS";
    os_version = firstMatch(ua, /os ([\d_]+)/);
  } else if (ua.includes("android")) {
    os = "Android";
    os_version = firstMatch(ua, /android ([\d.]+)/);
  } else if (ua.includes("win")) {
    os = "Windows";
    os_version = firstMatch(ua, /windows nt ([\d.]+)/);
  } else if (ua.includes("mac")) {
    os = "MacOS";
    os_version = firstMatch(ua, /mac os x ([\d_]+)/);
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  return {
    device_type,
    browser,
    browser_version,
    os,
    os_version,
    is_bot: BOT_PATTERN.test(ua),
  };
}

function extractUTMParams(url: string): { utm_source: string; utm_medium: string; utm_campaign: string } {
  try {
    const params = new URL(url).searchParams;
    return {
      utm_source: params.get("utm_source") ?? "",
      utm_medium: params.get("utm_medium") ?? "",
      utm_campaign: params.get("utm_campaign") ?? "",
    };
  } catch {
    return { utm_source: "", utm_medium: "", utm_campaign: "" };
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
}

function geoFromHeaders(req: Request): ResolvedGeo {
  const header = (name: string) => (req.headers.get(name) ?? "").trim();
  return {
    country: header("cf-ipcountry") || header("x-vercel-ip-country"),
    region: header("cf-region") || header("x-vercel-ip-country-region"),
    city: header("cf-ipcity") || header("x-vercel-ip-city"),
  };
}

async function resolveGeo(req: Request, ip: string): Promise<ResolvedGeo> {
  const fromHeaders = geoFromHeaders(req);
  if (!IPINFO_TOKEN || !ip) return fromHeaders;

  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${IPINFO_TOKEN}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return fromHeaders;
    const data = await res.json();
    return {
      country: data.country ?? fromHeaders.country,
      region: data.region ?? fromHeaders.region,
      city: data.city ?? fromHeaders.city,
    };
  } catch (err) {
    console.error("IP geolocation lookup failed:", err);
    return fromHeaders;
  }
}

function formatLocation(geo: ResolvedGeo): string {
  const parts = [geo.city, geo.region, geo.country].filter((part) => part && part.length > 0);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

function versioned(name: string, version: string): string {
  return version ? `${name} ${version}` : name;
}

/**
 * Start of the current day in the business's timezone. Subtracting the elapsed
 * local clock time keeps this correct across DST without hardcoding an offset -
 * UTC midnight would roll "today" over at 7pm Central.
 */
function businessDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const elapsedMs =
    (value("hour") % 24) * 3_600_000 +
    value("minute") * 60_000 +
    value("second") * 1_000 +
    now.getMilliseconds();

  return new Date(now.getTime() - elapsedMs);
}

async function sendEmail(to: string[], subject: string, html: string): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Boxed2Built <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.id ?? null;
}

interface EmailContext {
  title: string;
  slug: string;
  description: string;
  qrCodeId: string;
  shortUrl: string;
  destinationUrl: string;
  scannedAt: string;
  totalScans: number;
  scansToday: number;
  scansLast7Days: number;
  deviceType: string;
  deviceModel: string;
  browser: string;
  os: string;
  screenResolution: string;
  language: string;
  timezone: string;
  location: string;
  ipAddress: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  userAgent: string;
}

function row(label: string, value: string, opts: { mono?: boolean; muted?: boolean } = {}): string {
  const valueStyle = [
    "font-size:14px",
    opts.mono ? "font-family:monospace" : "",
    opts.muted ? "color:#6b7280" : "color:#111827",
  ]
    .filter(Boolean)
    .join(";");

  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;"><span style="color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(label)}</span></td>
    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;"><span style="${valueStyle};word-break:break-word;">${escapeHtml(value)}</span></td>
  </tr>`;
}

function sectionHeading(text: string): string {
  return `<tr><td colspan="2" style="padding:22px 0 6px;"><span style="color:#1e3a5f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(text)}</span></td></tr>`;
}

function scanNotificationEmail(c: EmailContext): string {
  const deviceLine = c.deviceModel ? `${c.deviceType} — ${c.deviceModel}` : c.deviceType;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">QR Code Scanned</h1>
        <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">${escapeHtml(c.title)}</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:28px 32px;">

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:8px;text-align:center;">
          <p style="margin:0 0 6px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Total Scans</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#1e3a5f;line-height:1.1;">${c.totalScans}</p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">${c.scansToday} today &bull; ${c.scansLast7Days} in the last 7 days</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0">
          ${sectionHeading("QR Code")}
          ${row("Title", c.title)}
          ${row("Slug", c.slug, { mono: true })}
          ${row("Short URL", c.shortUrl, { mono: true })}
          ${row("Forwarded To", c.destinationUrl || "Unknown")}
          ${c.description ? row("Notes", c.description, { muted: true }) : ""}

          ${sectionHeading("This Scan")}
          ${row("Scanned At", c.scannedAt)}
          ${row("Location", c.location)}
          ${row("IP Address", c.ipAddress || "Unknown", { mono: true })}

          ${sectionHeading("Device")}
          ${row("Device", deviceLine)}
          ${row("Operating System", c.os)}
          ${row("Browser", c.browser)}
          ${c.screenResolution ? row("Screen", c.screenResolution) : ""}
          ${c.language ? row("Language", c.language) : ""}
          ${c.timezone ? row("Device Timezone", c.timezone) : ""}

          ${sectionHeading("Source")}
          ${row("Referrer", c.referrer || "Direct / camera app")}
          ${c.utmSource ? row("UTM Source", c.utmSource) : ""}
          ${c.utmMedium ? row("UTM Medium", c.utmMedium) : ""}
          ${c.utmCampaign ? row("UTM Campaign", c.utmCampaign) : ""}
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="${escapeHtml(SITE_URL)}/admin/qr-codes/${escapeHtml(c.qrCodeId)}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:6px;">View Full Analytics &rarr;</a>
        </div>

        <details style="margin-top:20px;">
          <summary style="color:#6b7280;font-size:12px;cursor:pointer;">Raw user agent</summary>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;font-family:monospace;word-break:break-all;">${escapeHtml(c.userAgent || "Not provided")}</p>
        </details>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Boxed2Built QR analytics &bull; Turn these emails off per code in Admin &rarr; QR Codes</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

type ServiceClient = ReturnType<typeof createClient>;

async function countScans(supabase: ServiceClient, qrCodeId: string, since?: string): Promise<number> {
  let query = supabase
    .from("qr_scans")
    .select("id", { count: "exact", head: true })
    .eq("qr_code_id", qrCodeId);

  if (since) {
    query = query.gte("scanned_at", since);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function notificationsSentInLastHour(supabase: ServiceClient, qrCodeId: string): Promise<number> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("qr_scans")
    .select("id", { count: "exact", head: true })
    .eq("qr_code_id", qrCodeId)
    .gte("notification_sent_at", windowStart);

  if (error) throw error;
  return count ?? 0;
}

async function deliverNotification(
  supabase: ServiceClient,
  scanId: string,
  recipients: string[],
  subject: string,
  html: string,
): Promise<void> {
  try {
    const messageId = await sendEmail(recipients, subject, html);

    const { error } = await supabase
      .from("qr_scans")
      .update({ notification_sent_at: new Date().toISOString() })
      .eq("id", scanId);
    if (error) {
      console.error("Failed to stamp notification_sent_at:", error.message);
    }

    console.log(`Scan notification sent for scan ${scanId} (message ${messageId ?? "unknown"})`);
  } catch (err) {
    console.error("Scan notification email failed:", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload: ScanPayload = await req.json();

    if (!payload.slug && !payload.qrCodeId) {
      return new Response(JSON.stringify({ success: false, error: "slug or qrCodeId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const lookup = supabase
      .from("qr_codes")
      .select("id, organization_id, slug, title, description, default_destination_url, notify_on_scan, notification_email");
    const { data: qrCode, error: lookupError } = await (
      payload.slug ? lookup.eq("slug", payload.slug) : lookup.eq("id", payload.qrCodeId!)
    ).maybeSingle();

    if (lookupError) throw lookupError;
    if (!qrCode) {
      return new Response(JSON.stringify({ success: false, error: "QR code not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The browser's own user-agent header is more trustworthy than the body,
    // which is only a fallback for clients that cannot set it.
    const userAgent = req.headers.get("user-agent") ?? payload.userAgent ?? "";
    const parsed = parseUserAgent(userAgent);
    const ip = clientIp(req);
    const geo = await resolveGeo(req, ip);
    const utm = extractUTMParams(payload.pageUrl ?? "");
    const scannedAt = new Date();
    const destinationUrl = payload.destinationUrl || (qrCode.default_destination_url as string) || "";

    const { data: scan, error: insertError } = await supabase
      .from("qr_scans")
      .insert({
        qr_code_id: qrCode.id,
        organization_id: qrCode.organization_id,
        scanned_at: scannedAt.toISOString(),
        user_agent: userAgent,
        device_type: parsed.device_type,
        browser: parsed.browser,
        browser_version: payload.browserVersion || parsed.browser_version,
        os: parsed.os,
        os_version: payload.osVersion || parsed.os_version,
        device_model: payload.deviceModel ?? "",
        referrer: payload.referrer ?? "",
        destination_url: destinationUrl,
        ip_address: ip,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: payload.timezone ?? "",
        language: payload.language ?? "",
        screen_resolution: payload.screenResolution ?? "",
        is_bot: parsed.is_bot,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const dayStart = businessDayStart(scannedAt);
    const weekStart = new Date(scannedAt.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalScans, scansToday, scansLast7Days] = await Promise.all([
      countScans(supabase, qrCode.id as string),
      countScans(supabase, qrCode.id as string, dayStart.toISOString()),
      countScans(supabase, qrCode.id as string, weekStart.toISOString()),
    ]);

    let notified = false;
    let skippedReason: string | null = null;

    if (!RESEND_API_KEY) {
      skippedReason = "RESEND_API_KEY is not configured";
    } else if (qrCode.notify_on_scan === false) {
      skippedReason = "notifications disabled for this QR code";
    } else if (parsed.is_bot) {
      skippedReason = "scan looks like a crawler or link preview";
    } else if (MAX_EMAILS_PER_HOUR > 0 && (await notificationsSentInLastHour(supabase, qrCode.id as string)) >= MAX_EMAILS_PER_HOUR) {
      skippedReason = `hourly notification cap of ${MAX_EMAILS_PER_HOUR} reached`;
    }

    if (skippedReason) {
      console.log(`Scan ${scan.id} logged without email: ${skippedReason}`);
    } else {
      const recipient = (qrCode.notification_email as string | null)?.trim() || DEFAULT_NOTIFY_EMAIL;
      const location = formatLocation(geo);
      const emailContext: EmailContext = {
        title: qrCode.title as string,
        slug: qrCode.slug as string,
        description: (qrCode.description as string) ?? "",
        qrCodeId: qrCode.id as string,
        shortUrl: `${SITE_URL}/go/${qrCode.slug}`,
        destinationUrl,
        scannedAt: `${scannedAt.toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
        totalScans,
        scansToday,
        scansLast7Days,
        deviceType: parsed.device_type,
        deviceModel: payload.deviceModel ?? "",
        browser: versioned(parsed.browser, payload.browserVersion || parsed.browser_version),
        os: versioned(parsed.os, payload.osVersion || parsed.os_version),
        screenResolution: payload.screenResolution ?? "",
        language: payload.language ?? "",
        timezone: payload.timezone ?? "",
        location,
        ipAddress: ip,
        referrer: payload.referrer ?? "",
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
        userAgent,
      };

      const locationSuffix = location !== "Unknown" ? ` from ${location}` : "";
      const subject = `QR scan #${totalScans} — ${qrCode.title} (${parsed.device_type}${locationSuffix})`;
      const html = scanNotificationEmail(emailContext);

      // Hand the email off to the background so the visitor's redirect is
      // never waiting on Resend.
      const delivery = deliverNotification(supabase, scan.id as string, [recipient], subject, html);
      if (typeof EdgeRuntime !== "undefined") {
        EdgeRuntime.waitUntil(delivery);
      } else {
        await delivery;
      }
      notified = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanId: scan.id,
        totalScans,
        notified,
        ...(skippedReason ? { skippedReason } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-qr-scan error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
