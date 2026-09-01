import { ReactNode, useEffect } from 'react';
import { useLocation, useMatches } from 'react-router-dom';
import { ClientOnly } from 'vite-react-ssg';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationBarProvider } from '../contexts/NotificationBarContext';
import { ToastProvider } from '../contexts/ToastContext';
import { BusinessDataProvider, useBusinessDataContext } from '../contexts/BusinessDataContext';
import { CartProvider } from '../contexts/CartContext';
import CartHost from './store/CartHost';
import ScrollToTop from './ui/ScrollToTop';
import NotificationBar from './NotificationBar';
import { useNotificationBar } from '../hooks/useNotificationBar';
import { useManifestManager } from '../hooks/useManifestManager';
import type { CompleteBusinessData } from '../lib/supabase';
import { loadGoogleAnalytics } from '../utils/analyticsLoader';
import PageLoader from './ui/PageLoader';
import BoxLoader from './BoxLoader';
import { Suspense } from 'react';

type AnalyticsModule = typeof import('../utils/analytics');
let analyticsModulePromise: Promise<AnalyticsModule> | null = null;

const loadAnalyticsModule = (): Promise<AnalyticsModule> => {
  analyticsModulePromise ??= import('../utils/analytics');
  return analyticsModulePromise;
};

let scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };
let pageStartTime = Date.now();
let engagementTracked = false;

function Analytics() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/portal') || location.pathname.startsWith('/pay')) {
      return;
    }

    let analytics: AnalyticsModule | null = null;

    const run = async () => {
      void loadGoogleAnalytics();
      analytics = await loadAnalyticsModule();

      scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };
      pageStartTime = Date.now();
      engagementTracked = false;

      analytics.trackPageView(location.pathname, document.title);

      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'page_view', {
          page_path: location.pathname,
          page_title: document.title,
          page_location: window.location.href
        });
      }
    };

    run();

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight === 0) return;
      const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100);

      Object.keys(scrollDepthTracked).forEach(depth => {
        const depthNum = parseInt(depth);
        if (scrollPercentage >= depthNum && !scrollDepthTracked[depthNum as keyof typeof scrollDepthTracked]) {
          scrollDepthTracked[depthNum as keyof typeof scrollDepthTracked] = true;
          analytics?.trackScrollDepth(depthNum);
        }
      });

      if (!engagementTracked && scrollPercentage >= 50) {
        const timeOnPage = (Date.now() - pageStartTime) / 1000;
        if (timeOnPage >= 30) {
          analytics?.trackEngagementMilestone('engaged_user', timeOnPage);
          engagementTracked = true;
        }
      }
    };

    const handlePhoneLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const phoneLink = target?.closest('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (!phoneLink) return;
      const href = phoneLink.getAttribute('href') || '';
      const phoneNumber = href.replace(/^tel:/i, '').trim();
      const linkText = phoneLink.textContent?.trim();
      analytics?.trackPhoneLinkClick(phoneNumber || href, linkText);
    };

    const timeTrackingInterval = setInterval(() => {
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      if (timeOnPage >= 30 && timeOnPage < 35) {
        analytics?.trackEngagementMilestone('30_seconds', 30);
      } else if (timeOnPage >= 60 && timeOnPage < 65) {
        analytics?.trackEngagementMilestone('1_minute', 60);
      } else if (timeOnPage >= 180 && timeOnPage < 185) {
        analytics?.trackEngagementMilestone('3_minutes', 180);
      }
    }, 5000);

    const handleBeforeUnload = () => {
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      analytics?.trackTimeOnPage(Math.round(timeOnPage));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handlePhoneLinkClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handlePhoneLinkClick);
      clearInterval(timeTrackingInterval);
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      analytics?.trackTimeOnPage(Math.round(timeOnPage));
    };
  }, [location]);

  return null;
}

function HashHandler() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const elementId = location.hash.substring(1);
      const element = document.getElementById(elementId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}

function NotificationBarWrapper() {
  // Reuse the business id from the shared business data instead of issuing a
  // separate business_info lookup (and the round-trip waterfall behind it).
  const businessData = useBusinessDataContext();
  const businessId = businessData?.data?.info?.id ?? null;
  const { notification } = useNotificationBar(businessId);
  const location = useLocation();

  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/portal') || location.pathname.startsWith('/pay')) {
    return null;
  }

  return notification ? <NotificationBar notification={notification} /> : null;
}

function AnalyticsInitializer() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/portal') || location.pathname.startsWith('/pay')) {
      return;
    }
    void loadGoogleAnalytics();
  }, [location.pathname]);

  return null;
}

function ManifestManager() {
  useManifestManager();
  return null;
}

function ConditionalAuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  // /book is public but signed-in: it gates on a Google session, so it needs the
  // provider just as much as /admin and /portal do.
  if (
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/book')
  ) {
    return <AuthProvider>{children}</AuthProvider>;
  }
  return <>{children}</>;
}

function ClientOnlyBrowserComponents() {
  return (
    <ClientOnly>
      {() => (
        <>
          <NotificationBarWrapper />
          <AnalyticsInitializer />
          <ManifestManager />
          <Analytics />
          <HashHandler />
          <ScrollToTop />
        </>
      )}
    </ClientOnly>
  );
}

// Pull the build-time business data out of the matched route loader (if any)
// so the provider can paint immediately without a fetch.
function useLoaderBusinessData(): CompleteBusinessData | null {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const data = matches[i].data as { businessData?: CompleteBusinessData } | undefined;
    if (data?.businessData) return data.businessData;
  }
  return null;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const initialBusinessData = useLoaderBusinessData();

  // Admin/portal/pay/book routes don't consume the public business data wave, so
  // we skip the provider there to avoid an unnecessary fetch.
  const isAppRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/pay') ||
    location.pathname.startsWith('/book');

  // On the home page and QR redirect slugs the visible page already shows the
  // branded 3D box loader. Those pages are React.lazy, so on a fresh full page
  // load (e.g. arriving via a QR/redirect) the Suspense fallback flashes while
  // the chunk hydrates. Using the same BoxLoader here keeps the box on screen
  // the whole way through instead of swapping to a generic circle spinner.
  const useBoxLoader =
    !isAppRoute &&
    (location.pathname === '/' || location.pathname.startsWith('/go/'));

  const content = (
    <div className="min-h-screen">
      <ClientOnlyBrowserComponents />
      <Suspense
        fallback={
          useBoxLoader ? (
            <BoxLoader minDurationMs={999999} />
          ) : (
            <PageLoader message="Loading application..." />
          )
        }
      >
        {children}
      </Suspense>
    </div>
  );

  return (
    <NotificationBarProvider>
      <ToastProvider>
        <ConditionalAuthProvider>
          {isAppRoute ? (
            content
          ) : (
            <BusinessDataProvider initialData={initialBusinessData}>
              <CartProvider>
                {content}
                {/* Rendered here so the header's cart button opens the drawer
                    from any public page, not just the store. */}
                <ClientOnly>{() => <CartHost />}</ClientOnly>
              </CartProvider>
            </BusinessDataProvider>
          )}
        </ConditionalAuthProvider>
      </ToastProvider>
    </NotificationBarProvider>
  );
}
