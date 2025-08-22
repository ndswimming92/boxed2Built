import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  trackPageView, 
  trackScrollDepth, 
  trackTimeOnPage, 
  trackEngagementMilestone,
  trackEvent 
} from '../utils/analytics';

interface PageTrackingOptions {
  trackScrollDepth?: boolean;
  trackTimeOnPage?: boolean;
  trackEngagement?: boolean;
  engagementThreshold?: number; // seconds
  scrollThreshold?: number; // percentage
}

export const usePageTracking = (options: PageTrackingOptions = {}) => {
  const {
    trackScrollDepth: enableScrollTracking = true,
    trackTimeOnPage: enableTimeTracking = true,
    trackEngagement: enableEngagementTracking = true,
    engagementThreshold = 30,
    scrollThreshold = 50
  } = options;

  const location = useLocation();
  const startTimeRef = useRef<number>(Date.now());
  const scrollDepthTrackedRef = useRef<Record<number, boolean>>({});
  const engagementTrackedRef = useRef<boolean>(false);
  const maxScrollRef = useRef<number>(0);

  useEffect(() => {
    // Reset tracking state for new page
    startTimeRef.current = Date.now();
    scrollDepthTrackedRef.current = {};
    engagementTrackedRef.current = false;
    maxScrollRef.current = 0;

    // Track page view
    trackPageView(location.pathname, document.title);

    // Track page entry
    trackEvent('page_enter', location.pathname, {
      event_category: 'navigation',
      user_engagement: 'page_enter'
    });

    const handleScroll = () => {
      if (!enableScrollTracking) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (scrollHeight === 0) return;
      
      const scrollPercentage = Math.round((scrollTop / scrollHeight) * 100);
      maxScrollRef.current = Math.max(maxScrollRef.current, scrollPercentage);

      // Track scroll depth milestones
      const milestones = [25, 50, 75, 100];
      milestones.forEach(milestone => {
        if (scrollPercentage >= milestone && !scrollDepthTrackedRef.current[milestone]) {
          scrollDepthTrackedRef.current[milestone] = true;
          trackScrollDepth(milestone);
        }
      });

      // Track engagement based on scroll + time
      if (enableEngagementTracking && !engagementTrackedRef.current) {
        const timeOnPage = (Date.now() - startTimeRef.current) / 1000;
        if (scrollPercentage >= scrollThreshold && timeOnPage >= engagementThreshold) {
          engagementTrackedRef.current = true;
          trackEngagementMilestone('engaged_session', timeOnPage);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Track when user leaves page
        const timeOnPage = (Date.now() - startTimeRef.current) / 1000;
        trackEvent('page_hidden', location.pathname, {
          event_category: 'engagement',
          value: Math.round(timeOnPage),
          custom_parameter_1: `max_scroll_${maxScrollRef.current}%`
        });
      } else {
        // Track when user returns to page
        trackEvent('page_visible', location.pathname, {
          event_category: 'engagement'
        });
      }
    };

    const handleBeforeUnload = () => {
      if (!enableTimeTracking) return;
      
      const timeOnPage = (Date.now() - startTimeRef.current) / 1000;
      trackTimeOnPage(Math.round(timeOnPage));
      
      // Track exit intent
      trackEvent('page_exit', location.pathname, {
        event_category: 'navigation',
        value: Math.round(timeOnPage),
        custom_parameter_1: `max_scroll_${maxScrollRef.current}%`
      });
    };

    // Set up time-based engagement tracking
    let timeTrackingInterval: NodeJS.Timeout | null = null;
    if (enableTimeTracking) {
      timeTrackingInterval = setInterval(() => {
        const timeOnPage = (Date.now() - startTimeRef.current) / 1000;
        
        // Track time milestones
        if (timeOnPage >= 30 && timeOnPage < 35) {
          trackEngagementMilestone('30_seconds_on_page', 30);
        } else if (timeOnPage >= 60 && timeOnPage < 65) {
          trackEngagementMilestone('1_minute_on_page', 60);
        } else if (timeOnPage >= 180 && timeOnPage < 185) {
          trackEngagementMilestone('3_minutes_on_page', 180);
        } else if (timeOnPage >= 300 && timeOnPage < 305) {
          trackEngagementMilestone('5_minutes_on_page', 300);
        }
      }, 5000);
    }

    // Add event listeners
    if (enableScrollTracking) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      if (enableScrollTracking) {
        window.removeEventListener('scroll', handleScroll);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
      }

      // Final tracking on component unmount
      const finalTimeOnPage = (Date.now() - startTimeRef.current) / 1000;
      if (enableTimeTracking && finalTimeOnPage > 1) {
        trackTimeOnPage(Math.round(finalTimeOnPage));
      }
    };
  }, [location.pathname, enableScrollTracking, enableTimeTracking, enableEngagementTracking, engagementThreshold, scrollThreshold]);

  return {
    trackCustomEvent: (eventName: string, additionalParams?: any) => {
      trackEvent(eventName, location.pathname, {
        event_category: 'custom',
        ...additionalParams
      });
    }
  };
};