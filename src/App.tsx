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
import { useTheme } from './hooks/useTheme'; // Import useTheme hook

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
    // The useTheme hook is called here to initialize theme and apply 'dark' class to <html>
    // No explicit wrapper is needed as useTheme directly manipulates document.documentElement
    // eslint-disable-next-line react-hooks/rules-of-hooks
    <Router>
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
            </Routes>
          </PageLoadingWrapper>
        </Suspense>
        <ScrollToTop />
      </div>
    </Router>
  );
}

export default App;