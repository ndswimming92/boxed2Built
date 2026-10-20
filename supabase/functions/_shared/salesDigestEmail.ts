/**
 * The two emails a sales subscriber receives: the welcome sent at sign-up, and
 * the daily list of new sales.
 *
 * Pure rendering, no Deno or Supabase imports, so `tests/unit` can read a
 * finished email back and assert on it. Styled to match the quote confirmation
 * email in send-form-email (navy ground, gold accents, rounded cards).
 */

export interface DigestSale {
  id: string;
  title: string;
  summary: string;
  store_name: string | null;
  sale_scope: 'local' | 'online' | null;
  /** YYYY-MM-DD, Central. Null = no end date. */
  ends_on: string | null;
  source_url: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const NAVY = '#0E2748';
const NAVY_CARD = '#152F55';
const NAVY_LINE = '#25406B';
const GOLD = '#D9A441';
const MUTED = '#C3CCE0';
const LABEL = '#9FB0CC';
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Longest summary shown per sale; the full text is one click away. */
const SUMMARY_MAX = 320;

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "Nicholas Davidson" -> "Nicholas". Falls back to "there". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** Links come from a table whose rows are written by an automated process, so only http(s) is trusted. */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 2026-10-21 -> October 21, 2026. Parsed as plain parts so the day never slips. */
export function formatEndsOn(value: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function scopeLabel(scope: DigestSale['sale_scope']): string | null {
  return scope === 'local' ? 'Local store' : scope === 'online' ? 'Online' : null;
}

function shell(preheader: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${NAVY};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${NAVY};">${escapeHtml(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY}" style="background:${NAVY};padding:28px 12px 36px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
${inner}
    </table>
  </td></tr>
</table>
</body></html>`;
}

function logoRow(siteUrl: string): string {
  return `      <tr><td style="padding:0 12px 28px;text-align:center;">
        <a href="${siteUrl}" style="text-decoration:none;display:inline-block;"><img src="${siteUrl}/boxed2built_logo_email.png" width="96" height="96" alt="Boxed2Built" style="display:block;width:96px;height:96px;border:0;outline:none;color:#ffffff;font-size:20px;font-weight:800;"></a>
      </td></tr>`;
}

function headingRow(title: string, intro: string): string {
  return `      <tr><td style="padding:0 12px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;">${title}</h1>
        <div style="width:56px;height:4px;background:${GOLD};border-radius:4px;margin:16px auto 0;font-size:0;line-height:0;">&nbsp;</div>
        <p style="margin:18px 0 0;color:${MUTED};font-size:16px;line-height:1.6;">${intro}</p>
      </td></tr>`;
}

function footerRows(siteUrl: string, unsubscribeUrl: string, reason: string): string {
  return `      <tr><td style="padding:32px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${NAVY_LINE};">
          <tr>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">&#9733; 5-Star Rated</td>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">No Payment Until Done</td>
            <td style="padding:18px 4px 0;text-align:center;color:${MUTED};font-size:12px;font-weight:700;">Locally Owned</td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:${LABEL};font-size:12px;line-height:1.6;text-align:center;">${reason}</p>
        <p style="margin:10px 0 0;color:${LABEL};font-size:12px;line-height:1.6;text-align:center;"><a href="${unsubscribeUrl}" style="color:#ffffff;font-weight:700;text-decoration:underline;">Unsubscribe</a> from all future sales emails in one click.</p>
        <p style="margin:14px 0 0;color:${LABEL};font-size:12px;text-align:center;">Boxed2Built &bull; Spring Hill, TN &bull; <a href="${siteUrl}" style="color:${LABEL};">boxed2built.com</a></p>
      </td></tr>`;
}

function saleCard(sale: DigestSale): string {
  const url = safeHttpUrl(sale.source_url);
  const endsOn = formatEndsOn(sale.ends_on);
  const scope = scopeLabel(sale.sale_scope);
  const meta = [sale.store_name?.trim(), scope].filter(Boolean).map((part) => escapeHtml(part as string));

  return `      <tr><td style="padding:16px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY_CARD}" style="background:${NAVY_CARD};border-radius:16px;">
          <tr><td style="padding:22px 24px;">
            ${meta.length ? `<p style="margin:0 0 8px;color:${GOLD};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">${meta.join(' &middot; ')}</p>` : ''}
            <p style="margin:0 0 8px;color:#ffffff;font-size:18px;line-height:1.35;font-weight:700;">${escapeHtml(sale.title)}</p>
            <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.6;">${escapeHtml(truncate(sale.summary, SUMMARY_MAX))}</p>
            ${endsOn ? `<p style="margin:12px 0 0;color:${GOLD};font-size:13px;font-weight:700;">Ends ${escapeHtml(endsOn)}</p>` : ''}
            ${url ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${GOLD};color:${NAVY};font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:10px;">See the sale &rarr;</a></p>` : ''}
          </td></tr>
        </table>
      </td></tr>`;
}

export function renderDigestEmail(options: {
  name: string;
  sales: DigestSale[];
  unsubscribeUrl: string;
  siteUrl: string;
}): Rendered {
  const { name, sales, unsubscribeUrl, siteUrl } = options;
  const count = sales.length;
  const noun = count === 1 ? 'sale' : 'sales';
  const first = escapeHtml(firstName(name));

  const subject =
    count === 1
      ? `New furniture sale: ${sales[0].store_name?.trim() || sales[0].title}`
      : `${count} new furniture sales near Spring Hill`;

  const inner = [
    logoRow(siteUrl),
    headingRow(
      `${count} new ${noun}`,
      `Hi <strong style="color:#ffffff;">${first}</strong>, here ${count === 1 ? 'is the' : 'are the'} furniture ${noun} we added since our last email.`,
    ),
    `      <tr><td style="padding:12px 0 0;"></td></tr>`,
    ...sales.map(saleCard),
    `      <tr><td style="padding:28px 12px 0;text-align:center;">
        <a href="${siteUrl}/news" style="display:inline-block;background:${GOLD};color:${NAVY};font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">See all current sales</a>
        <p style="margin:20px 0 0;color:${LABEL};font-size:12px;line-height:1.6;">Sales are set by the stores, not by Boxed2Built, and can change or end without notice. Confirm the details with the store before you buy.</p>
        <p style="margin:22px 0 0;color:#ffffff;font-size:15px;">— The Boxed2Built Team</p>
      </td></tr>`,
    footerRows(
      siteUrl,
      unsubscribeUrl,
      'You are getting this because you signed up for daily furniture sales emails at boxed2built.com.',
    ),
  ].join('\n');

  const text = [
    `Hi ${firstName(name)},`,
    '',
    `${count} new furniture ${noun} since our last email:`,
    '',
    ...sales.flatMap((sale) => {
      const url = safeHttpUrl(sale.source_url);
      const endsOn = formatEndsOn(sale.ends_on);
      const meta = [sale.store_name?.trim(), scopeLabel(sale.sale_scope)].filter(Boolean).join(' - ');
      return [
        sale.title,
        ...(meta ? [meta] : []),
        truncate(sale.summary, SUMMARY_MAX),
        ...(endsOn ? [`Ends ${endsOn}`] : []),
        ...(url ? [url] : []),
        '',
      ];
    }),
    `All current sales: ${siteUrl}/news`,
    '',
    'Sales are set by the stores and can change or end without notice. Confirm the details with the store before you buy.',
    '',
    '— The Boxed2Built Team',
    '',
    `Unsubscribe from all future sales emails: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: shell(`${count} new furniture ${noun} from stores near Spring Hill, TN and online.`, inner),
    text,
  };
}

export function renderWelcomeEmail(options: {
  name: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): Rendered {
  const { name, unsubscribeUrl, siteUrl } = options;
  const first = escapeHtml(firstName(name));

  const bullet = (title: string, body: string, last = false) => `<tr>
              <td style="vertical-align:top;width:40px;${last ? '' : 'padding-bottom:18px;'}">
                <div style="width:30px;height:30px;background:${GOLD};border-radius:8px;text-align:center;line-height:30px;color:${NAVY};font-size:15px;font-weight:800;">&#10003;</div>
              </td>
              <td style="vertical-align:top;padding-left:12px;${last ? '' : 'padding-bottom:18px;'}">
                <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">${title}</p>
                <p style="margin:0;color:${MUTED};font-size:13px;line-height:1.55;">${body}</p>
              </td>
            </tr>`;

  const inner = [
    logoRow(siteUrl),
    headingRow(
      "You're subscribed!",
      `Thanks, <strong style="color:#ffffff;">${first}</strong>. You'll get an email each morning when we add new furniture sales.`,
    ),
    `      <tr><td style="padding:32px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${GOLD}" style="background:${GOLD};border-radius:16px;">
          <tr><td style="padding:26px 24px;text-align:center;">
            <p style="margin:0 0 10px;color:${NAVY};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:3px;">Sales are checked daily</p>
            <p style="margin:0 0 20px;color:${NAVY};font-size:15px;line-height:1.5;">See what is on sale right now at stores in and around Spring Hill, TN, and online.</p>
            <a href="${siteUrl}/news" style="display:inline-block;background:${NAVY};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">See Today's Sales &rarr;</a>
          </td></tr>
        </table>
      </td></tr>`,
    `      <tr><td style="padding:24px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="${NAVY_CARD}" style="background:${NAVY_CARD};border-radius:16px;">
          <tr><td style="padding:22px 24px;">
            <p style="margin:0 0 18px;color:${GOLD};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:3px;">What to Expect</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${bullet('One email a day, at most', 'Sent in the morning, and only on days we have added something new.')}
            ${bullet('Local stores and online', 'Furniture sales near Spring Hill, plus the big online retailers.')}
            ${bullet('Leave any time', 'Every email ends with an unsubscribe link that stops all future emails at once.', true)}
            </table>
          </td></tr>
        </table>
      </td></tr>`,
    `      <tr><td style="padding:28px 12px 0;text-align:center;">
        <p style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:600;font-style:italic;line-height:1.5;">Turning boxes into comfort so families can focus on what matters most.</p>
        <p style="margin:14px 0 18px;color:${MUTED};font-size:15px;line-height:1.6;">Bought something flat-packed? We'll put it together for you.</p>
        <a href="${siteUrl}/services/furniture-assembly" style="display:inline-block;background:${GOLD};color:${NAVY};font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">Furniture Assembly Service</a>
        <p style="margin:22px 0 0;color:#ffffff;font-size:15px;">— The Boxed2Built Team</p>
      </td></tr>`,
    footerRows(
      siteUrl,
      unsubscribeUrl,
      'You are getting this because this address was used to sign up for daily furniture sales emails at boxed2built.com. If that was not you, just unsubscribe below.',
    ),
  ].join('\n');

  const text = [
    `Hi ${firstName(name)},`,
    '',
    "You're subscribed. You'll get an email each morning when we add new furniture sales, and only on days we have something new.",
    '',
    `See what is on sale now: ${siteUrl}/news`,
    '',
    '— The Boxed2Built Team',
    '',
    `If this was not you, or you want to stop, unsubscribe here: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: "You're subscribed to Boxed2Built furniture sales",
    html: shell("You're subscribed to daily furniture sales from Boxed2Built.", inner),
    text,
  };
}
