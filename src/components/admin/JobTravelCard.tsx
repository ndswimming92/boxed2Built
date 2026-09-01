import type { Job } from '../../lib/supabase';
import { resolveWorkAddress } from '../../utils/jobAddress';
import { getJobTravelEstimate } from '../../services/jobTravelService';
import TravelEstimateCard from './TravelEstimateCard';

/**
 * The job-shaped entry point to the shared travel card: a job's destination is
 * its service address, falling back to the client profile's.
 */
export default function JobTravelCard({ job }: { job: Job }) {
  return (
    <TravelEstimateCard
      address={resolveWorkAddress(job)}
      reloadKey={job.id}
      loadEstimate={() => getJobTravelEstimate(job.id)}
    />
  );
}
