/**
 * Where a sales subscriber opts out, and the headers that let their mail app
 * offer an "Unsubscribe" button of its own.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page linked at the bottom of every email. */
export function unsubscribePageUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/unsubscribe-sales?token=${encodeURIComponent(token)}`;
}

/**
 * Gmail and Apple Mail show their own unsubscribe control from these headers,
 * and Gmail and Yahoo expect them on bulk mail. The one-click form POSTs to the
 * edge function, which opts the person out with no page in between.
 */
export function unsubscribeHeaders(
  supabaseUrl: string,
  siteUrl: string,
  token: string,
): Record<string, string> {
  const oneClick = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/sales-subscription?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${oneClick}>, <${unsubscribePageUrl(siteUrl, token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
