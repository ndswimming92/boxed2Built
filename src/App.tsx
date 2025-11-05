import React, { useEffect } from 'react';
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
import ScrollToTop from './components/ui/ScrollToTop';
import { trackPageView, trackScrollDepth, trackTimeOnPage, trackEngagementMilestone } from './utils/analytics';
import PageLoader from './components/ui/PageLoader';
import { usePageLoading } from './hooks/usePageLoading';
import { initializeFontOptimization } from './utils/fontOptimization';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
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

function PageLoadingWrapper({ children }: { children: React.ReactNode }) {
  const isLoading = usePageLoading(500); // 500ms loading delay

  if (isLoading) {
    return <PageLoader message="Loading page..." />;
  }

  return <>{children}</>;
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

function App() {
  useEffect(() => {
    document.title = 'Boxed2Built - Furniture Assembly Service';
    
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
        <div className="min-h-screen">
          <Analytics />
          <HashHandler />
          <Suspense fallback={<PageLoader message="Loading application..." />}>
            <PageLoadingWrapper>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/partners" element={<PartnersPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-of-service" element={<TermsOfServicePage />} />

                <Route path="/admin/login" element={<LoginPage />} />
                <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="business-info" element={<BusinessInfoPage />} />
                  <Route path="services" element={<ServicesAdminPage />} />
                  <Route path="service-areas" element={<ServiceAreasPage />} />
                  <Route path="reviews" element={<ReviewsPage />} />
                  <Route path="gallery" element={<GalleryAdminPage />} />
                  <Route path="business-hours" element={<BusinessHoursPage />} />
                  <Route path="payment-methods" element={<PaymentMethodsPage />} />
                  <Route path="social-media" element={<SocialMediaPage />} />
                  <Route path="attributes" element={<AttributesPage />} />
                </Route>
              </Routes>
            </PageLoadingWrapper>
          </Suspense>
          <ScrollToTop />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;