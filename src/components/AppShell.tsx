import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ClientOnly } from 'vite-react-ssg';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationBarProvider } from '../contexts/NotificationBarContext';
import { ToastProvider } from '../contexts/ToastContext';
import ScrollToTop from './ui/ScrollToTop';
import NotificationBar from './NotificationBar';
import { useNotificationBar } from '../hooks/useNotificationBar';
import { useManifestManager } from '../hooks/useManifestManager';
import { supabase } from '../lib/supabase';
import { loadGoogleAnalytics } from '../utils/analyticsLoader';
import PageLoader from './ui/PageLoader';
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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const { notification } = useNotificationBar(businessId);
  const location = useLocation();

  useEffect(() => {
    const fetchBusinessId = async () => {
      const { data } = await supabase
        .from('business_info')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (data) setBusinessId(data.id);
    };
    fetchBusinessId();
  }, []);

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
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/portal')) {
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

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <NotificationBarProvider>
      <ToastProvider>
        <ConditionalAuthProvider>
          <div className="min-h-screen">
            <ClientOnlyBrowserComponents />
            <Suspense fallback={<PageLoader message="Loading application..." />}>
              {children}
            </Suspense>
          </div>
        </ConditionalAuthProvider>
      </ToastProvider>
    </NotificationBarProvider>
  );
}
