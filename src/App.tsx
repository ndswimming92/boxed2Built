import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import FurnitureAssemblyPage from './pages/services/FurnitureAssemblyPage';
import TVMountingPage from './pages/services/TVMountingPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import GalleryPage from './pages/GalleryPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PartnersPage from './pages/PartnersPage';
import RequestLookupPage from './pages/RequestLookupPage';
import FAQPage from './pages/FAQPage';
import ScrollToTop from './components/ui/ScrollToTop';
import { trackPageView, trackScrollDepth, trackTimeOnPage, trackEngagementMilestone } from './utils/analytics';
import PageLoader from './components/ui/PageLoader';
import { initPostHog } from './lib/posthog';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationBarProvider } from './contexts/NotificationBarContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import NotificationBar from './components/NotificationBar';
import { useNotificationBar } from './hooks/useNotificationBar';
import { supabase } from './lib/supabase';
import QRRedirectPage from './pages/QRRedirectPage';
import { useManifestManager } from './hooks/useManifestManager';

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
    // Reset tracking for new page
    scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };
    pageStartTime = Date.now();
    engagementTracked = false;
    
    // Track page views with Google Analytics
    trackPageView(location.pathname, document.title);
    
    // Additional GA4 specific tracking
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: location.pathname,
        page_title: document.title,
        page_location: window.location.href
      });
    }
    
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
          trackScrollDepth(depthNum);
        }
      });
      
      // Track engagement after 30 seconds and 50% scroll
      if (!engagementTracked && scrollPercentage >= 50) {
        const timeOnPage = (Date.now() - pageStartTime) / 1000;
        if (timeOnPage >= 30) {
          trackEngagementMilestone('engaged_user', timeOnPage);
          engagementTracked = true;
        }
      }
    };
    
    // Set up time tracking
    const timeTrackingInterval = setInterval(() => {
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      
      // Track time milestones
      if (timeOnPage >= 30 && timeOnPage < 35) {
        trackEngagementMilestone('30_seconds', 30);
      } else if (timeOnPage >= 60 && timeOnPage < 65) {
        trackEngagementMilestone('1_minute', 60);
      } else if (timeOnPage >= 180 && timeOnPage < 185) {
        trackEngagementMilestone('3_minutes', 180);
      }
    }, 5000); // Check every 5 seconds
    
    // Track page exit
    const handleBeforeUnload = () => {
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      trackTimeOnPage(Math.round(timeOnPage));
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(timeTrackingInterval);
      
      // Track final time on page
      const timeOnPage = (Date.now() - pageStartTime) / 1000;
      trackTimeOnPage(Math.round(timeOnPage));
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

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return notification ? <NotificationBar notification={notification} /> : null;
}

function PostHogInitializer() {
  const location = useLocation();

  useEffect(() => {
    // Only initialize PostHog on non-admin routes
    if (!location.pathname.startsWith('/admin')) {
      initPostHog();
    }
  }, [location.pathname]);

  return null;
}

function ManifestManager() {
  useManifestManager();
  return null;
}

function App() {
  useEffect(() => {
    document.title = 'Boxed2Built - Furniture Assembly Service';

    // Track app initialization
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'app_initialized', {
        event_category: 'app_lifecycle',
        page_location: window.location.href
      });
    }
  }, []);

  return (
    <Router>
      <AuthProvider>
        <NotificationBarProvider>
          <div className="min-h-screen">
            <NotificationBarWrapper />
            <PostHogInitializer />
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

                <Route path="/admin/login" element={<LoginPage />} />
                <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
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
                  <Route path="business-info" element={<BusinessInfoPage />} />
                  <Route path="services" element={<ServicesAdminPage />} />
                  <Route path="service-areas" element={<ServiceAreasPage />} />
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
                  <Route path="attributes" element={<AttributesPage />} />
                </Route>
              </Routes>
            </Suspense>
            <ScrollToTop />
          </div>
        </NotificationBarProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
