import {
  ADMIN_BRANDING_DEFAULTS,
  buildAdminIconDataUrl,
  fetchAdminBranding,
  getCachedAdminBranding,
} from '../services/brandingService';

const DEFAULT_PUBLIC_THEME = '#0066cc';
const DEFAULT_PUBLIC_TITLE = 'Boxed2Built';

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, attrs: Record<string, string>) {
  const selectorAttrs = Object.entries(attrs)
    .filter(([k]) => k === 'sizes' || k === 'type')
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('');
  const selector = `link[rel="${rel}"]${selectorAttrs}`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k !== 'href') el!.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function removeLinksMatching(rel: string) {
  document.querySelectorAll(`link[rel="${rel}"]`).forEach((n) => n.parentElement?.removeChild(n));
}

function applyAdminBranding(themeColor: string, markColor: string, markText: string, title: string, statusBar: string, iconUrl: string | null) {
  const dataIcon = iconUrl || buildAdminIconDataUrl(themeColor, markColor, markText);

  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    document.head.appendChild(manifestLink);
  }
  manifestLink.setAttribute('href', '/admin.webmanifest');

  setMeta('theme-color', themeColor);
  setMeta('apple-mobile-web-app-title', title);
  setMeta('apple-mobile-web-app-status-bar-style', statusBar);
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('mobile-web-app-capable', 'yes');
  setMeta('application-name', title);

  removeLinksMatching('apple-touch-icon');
  removeLinksMatching('apple-touch-icon-precomposed');
  setLink('apple-touch-icon', { sizes: '180x180', href: dataIcon });
  setLink('apple-touch-icon-precomposed', { sizes: '180x180', href: dataIcon });

  document.querySelectorAll('link[rel="icon"]').forEach((n) => n.parentElement?.removeChild(n));
  setLink('icon', { type: 'image/svg+xml', href: dataIcon });

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  if (typeof window !== 'undefined') {
    canonicalLink.setAttribute('href', `${window.location.origin}${window.location.pathname}`);
  }
}

function applyPublicBranding() {
  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    document.head.appendChild(manifestLink);
  }
  manifestLink.setAttribute('href', '/site.webmanifest');

  setMeta('theme-color', DEFAULT_PUBLIC_THEME);
  setMeta('apple-mobile-web-app-title', DEFAULT_PUBLIC_TITLE);
  setMeta('apple-mobile-web-app-status-bar-style', 'default');
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('mobile-web-app-capable', 'yes');
  setMeta('application-name', DEFAULT_PUBLIC_TITLE);

  removeLinksMatching('apple-touch-icon');
  removeLinksMatching('apple-touch-icon-precomposed');
  setLink('apple-touch-icon', { sizes: '180x180', href: '/black_boxed2built_logo.png' });

  document.querySelectorAll('link[rel="icon"]').forEach((n) => n.parentElement?.removeChild(n));
  setLink('icon', { type: 'image/png', href: '/black_boxed2built_logo.png' });
  setLink('icon', { type: 'image/png', sizes: '32x32', href: '/black_boxed2built_logo.png' });
  setLink('icon', { type: 'image/png', sizes: '16x16', href: '/black_boxed2built_logo.png' });
}

export function updateManifest(isAdminRoute: boolean): void {
  if (!isAdminRoute) {
    applyPublicBranding();
    return;
  }

  // Apply immediately from cache or defaults so there is no flash of main-site branding
  const cached = getCachedAdminBranding();
  const immediate = cached || {
    ...ADMIN_BRANDING_DEFAULTS,
    id: '',
    created_at: '',
    updated_at: '',
  };
  applyAdminBranding(
    immediate.theme_color,
    immediate.mark_color,
    immediate.mark_text,
    immediate.title,
    immediate.status_bar_style,
    immediate.icon_url,
  );

  // Refresh from Supabase in the background
  fetchAdminBranding(false)
    .then((branding) => {
      applyAdminBranding(
        branding.theme_color,
        branding.mark_color,
        branding.mark_text,
        branding.title,
        branding.status_bar_style,
        branding.icon_url,
      );
    })
    .catch((err) => {
      console.warn('Admin branding refresh failed', err);
    });
}
