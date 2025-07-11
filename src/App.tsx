import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import ScrollToTop from './components/ui/ScrollToTop';
import { trackPageView } from './utils/analytics';
import PageLoader from './components/ui/PageLoader';
import { usePageLoading } from './hooks/usePageLoading';
import { initializeFontOptimization } from './utils/fontOptimization';

function Analytics() {
  const location = useLocation();

  useEffect(() => {
    // Track page views
    trackPageView(location.pathname, document.title);
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
  }, []);

  return (
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