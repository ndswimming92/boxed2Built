import React, { ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ui/ScrollToTop';
import PageLoader from './components/ui/PageLoader';
import { loadGoogleAnalytics } from './utils/analyticsLoader';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationBarProvider } from './contexts/NotificationBarContext';
import { ToastProvider } from './contexts/ToastContext';
import AdminRouteGuard from './components/auth/AdminRouteGuard';
import PortalRouteGuard from './components/auth/PortalRouteGuard';
import NotificationBar from './components/NotificationBar';
import { useNotificationBar } from './hooks/useNotificationBar';
import { useManifestManager } from './hooks/useManifestManager';
import { supabase } from './lib/supabase';

type AnalyticsModule = typeof import('./utils/analytics');
let analyticsModulePromise: Promise<AnalyticsModule> | null = null;

const loadAnalyticsModule = (): Promise<AnalyticsModule> => {
  analyticsModulePromise ??= import('./utils/analytics');
  return analyticsModulePromise;
};

const HomePage = lazy(() => import('./pages/HomePage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const FurnitureAssemblyPage = lazy(() => import('./pages/services/FurnitureAssemblyPage'));
const TVMountingPage = lazy(() => import('./pages/services/TVMountingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const RequestLookupPage = lazy(() => import('./pages/RequestLookupPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const QRRedirectPage = lazy(() => import('./pages/QRRedirectPage'));
const InvoicePaymentPage = lazy(() => import('./pages/InvoicePaymentPage'));
const InvoiceThankYouPage = lazy(() => import('./pages/InvoiceThankYouPage'));

const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const BusinessInfoPage = lazy(() => import('./pages/admin/BusinessInfoPage'));
const ServicesAdminPage = lazy(() => import('./pages/admin/ServicesPage'));
const ServiceAreasPage = lazy(() => import('./pages/admin/ServiceAreasPage'));
const ReviewsPage = lazy(() => import('./pages/admin/ReviewsPage'));
const BusinessHoursPage = lazy(() => import('./pages/admin/BusinessHoursPage'));
const PaymentMethodsPage = lazy(() => import('./pages/admin/PaymentMethodsPage'));
const SocialMediaPage = lazy(() => import('./pages/admin/SocialMediaPage'));
const UTMLinkBuilderPage = lazy(() => import('./pages/admin/UTMLinkBuilderPage'));
const AttributesPage = lazy(() => import('./pages/admin/AttributesPage'));
const GalleryAdminPage = lazy(() => import('./pages/admin/GalleryPage'));
const JobsAdminPage = lazy(() => import('./pages/admin/JobsPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const InquiriesPage = lazy(() => import('./pages/admin/InquiriesPage'));
const InvoicesPage = lazy(() => import('./pages/admin/InvoicesPage'));
const InvoiceSettingsPage = lazy(() => import('./pages/admin/InvoiceSettingsPage'));
const ForecastingPage = lazy(() => import('./pages/admin/ForecastingPage'));
const NotificationBarPage = lazy(() => import('./pages/admin/NotificationBarPage'));
const TaxSettingsPage = lazy(() => import('./pages/admin/TaxSettingsPage'));
const MileageSettingsPage = lazy(() => import('./pages/admin/MileageSettingsPage'));
const GoalsPage = lazy(() => import('./pages/admin/GoalsPage'));
const ActivityLogsPage = lazy(() => import('./pages/admin/ActivityLogsPage'));
const QRCodesPage = lazy(() => import('./pages/admin/QRCodesPage'));
const QRCodeDetailPage = lazy(() => import('./pages/admin/QRCodeDetailPage'));
const CompletionsPage = lazy(() => import('./pages/admin/CompletionsPage'));
const RemindersPage = lazy(() => import('./pages/admin/RemindersPage'));
const FinancesPage = lazy(() => import('./pages/admin/FinancesPage'));
const ClientsPage = lazy(() => import('./pages/admin/ClientsPage'));
const TestIdentifiersPage = lazy(() => import('./pages/admin/TestIdentifiersPage'));
const EmailActivityPage = lazy(() => import('./pages/admin/EmailActivityPage'));
const PortalLoginPage = lazy(() => import('./pages/portal/LoginPage'));
const PortalDashboardPage = lazy(() => import('./pages/portal/DashboardPage'));

// Scroll depth tracking
let scrollDepthTracked = {
  25: false,
  50: false,
  75: false,
  100: false
};

// Time tracking
let pageStartTime = Date.now();
let engagementTracked = false;

function Analytics() {
  const location = useLocation();

  useEffect(() => {
    let analytics: AnalyticsModule | null = null;

    const run = async () => {
      analytics = await loadAnalyticsModule();

      // Reset tracking for new page
      scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };
      pageStartTime = Date.now();
      engagementTracked = false;

      // Track page views with Google Analytics
      analytics.trackPageView(location.pathname, document.title);

    // Additional GA4 specific tracking
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'page_view', {
          page_path: location.pathname,
          page_title: document.title,
          page_location: window.location.href
        });
      }
    };

    run();

    // Set up scroll depth tracking
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (scrollHeight === 0) return;

      const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100);

      // Track scroll depth milestones
      Object.keys(scrollDepthTracked).forEach(depth => {
        const depthNum = parseInt(depth);
        if (scrollPercentage >= depthNum && !scrollDepthTracked[depthNum as keyof typeof scrollDepthTracked]) {
          scrollDepthTracked[depthNum as keyof typeof scrollDepthTracked] = true;
          analytics?.trackScrollDepth(depthNum);
        }
      });

      // Track engagement after 30 seconds and 50% scroll
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

    // Set up time tracking
    const timeTrackingInterval = setInterval(() => {
      const timeOnPage = (Date.now() - pageStartTime) / 1000;

      // Track time milestones
      if (timeOnPage >= 30 && timeOnPage < 35) {
        analytics?.trackEngagementMilestone('30_seconds', 30);
      } else if (timeOnPage >= 60 && timeOnPage < 65) {
        analytics?.trackEngagementMilestone('1_minute', 60);
      } else if (timeOnPage >= 180 && timeOnPage < 185) {
        analytics?.trackEngagementMilestone('3_minutes', 180);
      }
    }, 5000); // Check every 5 seconds

    // Track page exit
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

      // Track final time on page
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      analytics?.trackTimeOnPage(Math.round(timeOnPage));
    };
  }, [location]);

  return null;
}

function HashHandler() {
  const location = useLocation();

  useEffect(() => {
    // Handle hash navigation when page loads or hash changes
    if (location.hash) {
      const elementId = location.hash.substring(1); // Remove the # symbol
      const element = document.getElementById(elementId);

      if (element) {
        // Small delay to ensure the page is fully rendered
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      }
    } else {
      // Scroll to top when navigating to a new page without hash
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
      if (data) {
        setBusinessId(data.id);
      }
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
    // Only initialize analytics scripts on non-admin routes and defer until user interaction.
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/portal')) return;

    let isLoaded = false;

    const initializeAnalytics = () => {
      if (isLoaded) return;
      isLoaded = true;
      loadGoogleAnalytics();
      window.removeEventListener('pointerdown', initializeAnalytics);
      window.removeEventListener('keydown', initializeAnalytics);
      window.removeEventListener('scroll', initializeAnalytics);
      window.removeEventListener('touchstart', initializeAnalytics);
    };

    window.addEventListener('pointerdown', initializeAnalytics, { once: true, passive: true });
    window.addEventListener('keydown', initializeAnalytics, { once: true });
    window.addEventListener('scroll', initializeAnalytics, { once: true, passive: true });
    window.addEventListener('touchstart', initializeAnalytics, { once: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', initializeAnalytics);
      window.removeEventListener('keydown', initializeAnalytics);
      window.removeEventListener('scroll', initializeAnalytics);
      window.removeEventListener('touchstart', initializeAnalytics);
    };
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

function App() {
  useEffect(() => {
    document.title = 'Boxed2Built - Furniture Assembly Service';
  }, []);

  return (
    <Router>
      <NotificationBarProvider>
        <ToastProvider>
          <ConditionalAuthProvider>
            <div className="min-h-screen">
              <NotificationBarWrapper />
              <AnalyticsInitializer />
              <ManifestManager />
              <Analytics />
              <HashHandler />
              <Suspense fallback={<PageLoader message="Loading application..." />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/services/furniture-assembly" element={<FurnitureAssemblyPage />} />
                  <Route path="/services/tv-mounting" element={<TVMountingPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/partners" element={<PartnersPage />} />
                  <Route path="/gallery" element={<GalleryPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                  <Route path="/lookup-request" element={<RequestLookupPage />} />
                  <Route path="/go/:slug" element={<QRRedirectPage />} />
                  <Route path="/pay/:invoiceId" element={<InvoicePaymentPage />} />
                  <Route path="/pay/:invoiceId/thank-you" element={<InvoiceThankYouPage />} />

                  <Route path="/admin/login" element={<LoginPage />} />
                  <Route path="/portal/login" element={<PortalLoginPage />} />
                  <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
                  <Route path="/portal/dashboard" element={<PortalRouteGuard><PortalDashboardPage /></PortalRouteGuard>} />

                  <Route path="/admin" element={<AdminRouteGuard><AdminLayout /></AdminRouteGuard>}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="goals" element={<GoalsPage />} />
                    <Route path="inquiries" element={<InquiriesPage />} />
                    <Route path="invoices" element={<InvoicesPage />} />
                    <Route path="invoice-settings" element={<InvoiceSettingsPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="finances" element={<FinancesPage />} />
                    <Route path="forecasting" element={<ForecastingPage />} />
                    <Route path="tax-settings" element={<TaxSettingsPage />} />
                    <Route path="mileage-settings" element={<MileageSettingsPage />} />
                    <Route path="notification-bar" element={<NotificationBarPage />} />
                    <Route path="activity-logs" element={<ActivityLogsPage />} />
                    <Route path="test-identifiers" element={<TestIdentifiersPage />} />
                    <Route path="business-info" element={<BusinessInfoPage />} />
                    <Route path="services" element={<ServicesAdminPage />} />
                    <Route path="service-areas" element={<ServiceAreasPage />} />
                    <Route path="clients" element={<ClientsPage />} />
                    <Route path="reviews" element={<ReviewsPage />} />
                    <Route path="gallery" element={<GalleryAdminPage />} />
                    <Route path="qr-codes" element={<QRCodesPage />} />
                    <Route path="qr-codes/:id" element={<QRCodeDetailPage />} />
                    <Route path="jobs" element={<JobsAdminPage />} />
                    <Route path="completions" element={<CompletionsPage />} />
                    <Route path="reminders" element={<RemindersPage />} />
                    <Route path="business-hours" element={<BusinessHoursPage />} />
                    <Route path="payment-methods" element={<PaymentMethodsPage />} />
                    <Route path="social-media" element={<SocialMediaPage />} />
                    <Route path="utm-link-builder" element={<UTMLinkBuilderPage />} />
                    <Route path="attributes" element={<AttributesPage />} />
                    <Route path="email-activity" element={<EmailActivityPage />} />
                  </Route>
                </Routes>
              </Suspense>
              <ScrollToTop />
            </div>
          </ConditionalAuthProvider>
        </ToastProvider>
      </NotificationBarProvider>
    </Router>
  );
}

export default App;
