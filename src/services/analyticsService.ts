import { supabase } from '../lib/supabase';
import { Job } from '../lib/supabase';

export * from './analyticsCalculations';

export async function fetchJobsData(businessId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('date_completed', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  return data || [];
}
