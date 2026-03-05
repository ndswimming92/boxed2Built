export function updateManifest(isAdminRoute: boolean): void {
  const manifestPath = isAdminRoute ? '/admin.webmanifest' : '/site.webmanifest';
  const themeColor = isAdminRoute ? '#60A5FA' : '#0066cc';
  const appTitle = isAdminRoute ? 'Boxed2Built Admin' : 'Boxed2Built';
  const statusBarStyle = isAdminRoute ? 'black-translucent' : 'default';

  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    document.head.appendChild(manifestLink);
  }
  manifestLink.setAttribute('href', manifestPath);

  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.setAttribute('name', 'theme-color');
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.setAttribute('content', themeColor);

  let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!appleTitleMeta) {
    appleTitleMeta = document.createElement('meta');
    appleTitleMeta.setAttribute('name', 'apple-mobile-web-app-title');
    document.head.appendChild(appleTitleMeta);
  }
  appleTitleMeta.setAttribute('content', appTitle);

  let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!appleStatusBarMeta) {
    appleStatusBarMeta = document.createElement('meta');
    appleStatusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(appleStatusBarMeta);
  }
  appleStatusBarMeta.setAttribute('content', statusBarStyle);

  let appleCapableMeta = document.querySelector('meta[name="mobile-web-app-capable"]');
  if (!appleCapableMeta) {
    appleCapableMeta = document.createElement('meta');
    appleCapableMeta.setAttribute('name', 'mobile-web-app-capable');
    document.head.appendChild(appleCapableMeta);
  }
  appleCapableMeta.setAttribute('content', 'yes');
}
