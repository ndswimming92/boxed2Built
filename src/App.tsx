import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
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
import { initializeFontOptimization } from './utils/fontOptimization';
import { initPostHog } from './lib/posthog';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationBarProvider } from './contexts/NotificationBarContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import NotificationBar from './components/NotificationBar';
import { useNotificationBar } from './hooks/useNotificationBar';
import { supabase } from './lib/supabase';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import BusinessInfoPage from './pages/admin/BusinessInfoPage';
import ServicesAdminPage from './pages/admin/ServicesPage';
import ServiceAreasPage from './pages/admin/ServiceAreasPage';
import ReviewsPage from './pages/admin/ReviewsPage';
import BusinessHoursPage from './pages/admin/BusinessHoursPage';
import PaymentMethodsPage from './pages/admin/PaymentMethodsPage';
import SocialMediaPage from './pages/admin/SocialMediaPage';
import AttributesPage from './pages/admin/AttributesPage';
import GalleryAdminPage from './pages/admin/GalleryPage';
import JobsAdminPage from './pages/admin/JobsPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import InquiriesPage from './pages/admin/InquiriesPage';
import InvoicesPage from './pages/admin/InvoicesPage';
import InvoiceSettingsPage from './pages/admin/InvoiceSettingsPage';
import ForecastingPage from './pages/admin/ForecastingPage';
import NotificationBarPage from './pages/admin/NotificationBarPage';
import TaxSettingsPage from './pages/admin/TaxSettingsPage';
import GoalsPage from './pages/admin/GoalsPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';
import QRRedirectPage from './pages/QRRedirectPage';
import QRCodesPage from './pages/admin/QRCodesPage';
import QRCodeDetailPage from './pages/admin/QRCodeDetailPage';

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

function App() {
  useEffect(() => {
    document.title = 'Boxed2Built - Furniture Assembly Service';

    // Initialize PostHog
    initPostHog();

    // Initialize font optimization
    initializeFontOptimization();

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
            <Analytics />
            <HashHandler />
            <Suspense fallback={<PageLoader message="Loading application..." />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
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
                  <Route path="forecasting" element={<ForecastingPage />} />
                  <Route path="tax-settings" element={<TaxSettingsPage />} />
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