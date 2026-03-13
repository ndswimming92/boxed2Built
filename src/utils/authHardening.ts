const HTTPS_LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function normalizeHttpsUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl, window.location.origin);

  if (parsed.protocol !== 'https:') {
    throw new Error(`Insecure URL configured for authentication flow: ${parsed.toString()}`);
  }

  return parsed.toString();
}

export function enforceHttpsInBrowser(): void {
  if (typeof window === 'undefined') return;

  const { protocol, hostname, href } = window.location;

  if (protocol === 'https:') return;
  if (HTTPS_LOCALHOST_HOSTS.has(hostname)) return;

  const secureUrl = href.replace(/^http:/i, 'https:');
  window.location.replace(secureUrl);
}

export function getSecureAuthRedirectUrl(path: string, configuredUrl?: string): string {
  if (configuredUrl) {
    return normalizeHttpsUrl(configuredUrl);
  }

  const defaultUrl = new URL(path, window.location.origin);
  if (defaultUrl.protocol === 'http:' && HTTPS_LOCALHOST_HOSTS.has(defaultUrl.hostname)) {
    return defaultUrl.toString();
  }

  if (defaultUrl.protocol !== 'https:') {
    throw new Error(`Auth redirect must use HTTPS: ${defaultUrl.toString()}`);
  }

  return defaultUrl.toString();
}
