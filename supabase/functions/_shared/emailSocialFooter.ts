// Shared social-media footer for customer-facing emails.
// Icons are hosted PNGs (email clients block inline SVG / data URIs).

// Pure module (no Deno imports) so unit tests can import it.
const SITE_URL = 'https://boxed2built.com';

export const SOCIAL_LINKS = [
  { label: 'Facebook', url: 'https://www.facebook.com/BoxedToBuiltUSA', icon: 'facebook' },
  { label: 'Instagram', url: 'https://www.instagram.com/boxed2built/', icon: 'instagram' },
  { label: 'YouTube', url: 'https://www.youtube.com/@Boxed2BuiltUSA', icon: 'youtube' },
] as const;

export type FooterTheme = 'light' | 'dark';

/** 'dark' = for emails with a dark/navy page background (white icons, light label). */
export function socialFooterHtml(theme: FooterTheme = 'light'): string {
  const dark = theme === 'dark';
  const suffix = dark ? '-light' : '';
  const cells = SOCIAL_LINKS.map(
    (s) =>
      `<td style="padding:0 6px;"><a href="${s.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;"><img src="${SITE_URL}/email-icons/${s.icon}${suffix}.png" width="36" height="36" alt="${s.label}" style="display:block;width:36px;height:36px;border:0;outline:none;color:${dark ? '#ffffff' : '#1e3a8a'};font-size:12px;"></a></td>`,
  ).join('');
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 24px;"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${dark ? '#94a3b8' : '#64748b'};padding-bottom:10px;">Follow Boxed2Built</td></tr><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr></table>`;
}

export function socialFooterText(): string {
  return `Follow Boxed2Built: ${SOCIAL_LINKS.map((s) => `${s.label} ${s.url}`).join(' | ')}`;
}

/** Inserts the social footer just before the closing </body> tag. */
export function withSocialFooter(html: string, theme: FooterTheme = 'light'): string {
  const i = html.lastIndexOf('</body>');
  return i === -1 ? html + socialFooterHtml(theme) : html.slice(0, i) + socialFooterHtml(theme) + html.slice(i);
}
