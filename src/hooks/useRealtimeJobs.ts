import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Job } from '../lib/supabase';
import { fetchJobsData } from '../services/analyticsService';

interface UseRealtimeJobsResult {
  jobs: Job[];
  loading: boolean;
  lastUpdated: Date | null;
  isConnected: boolean;
}

export function useRealtimeJobs(businessId: string | null): UseRealtimeJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadInitialData = async () => {
      try {
        const data = await fetchJobsData(businessId);
        if (mounted) {
          setJobs(data);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading initial jobs data:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    const channel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `business_id=eq.${businessId}`,
        },
        async (payload) => {
          console.log('Real-time update received:', payload);

          if (payload.eventType === 'INSERT') {
            const newJob = payload.new as Job;
            if (mounted && newJob.is_active) {
              setJobs(prev => [newJob, ...prev]);
              setLastUpdated(new Date());
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedJob = payload.new as Job;
            if (mounted) {
              setJobs(prev =>
                prev.map(job => (job.id === updatedJob.id ? updatedJob : job))
              );
              setLastUpdated(new Date());
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedJob = payload.old as Job;
            if (mounted) {
              setJobs(prev => prev.filter(job => job.id !== deletedJob.id));
              setLastUpdated(new Date());
            }
          }
        }
      )
      .subscribe((status) => {
        if (mounted) {
          setIsConnected(status === 'SUBSCRIBED');
          console.log('Real-time subscription status:', status);
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  return { jobs, loading, lastUpdated, isConnected };
}
