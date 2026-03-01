import { supabase } from '../lib/supabase';
import type { Job, JobStatus, LostReasonCategory } from '../lib/supabase';
import { logAction } from './auditLogService';

export interface MarkJobLostParams {
  jobId: string;
  lostReasonCategory: LostReasonCategory;
  lostReasonNotes?: string;
  userId?: string;
}

export interface MarkJobCancelledParams {
  jobId: string;
  cancellationNotes?: string;
  userId?: string;
}

export interface UpdateJobStatusParams {
  jobId: string;
  newStatus: JobStatus;
  userId?: string;
  lostReasonCategory?: LostReasonCategory;
  lostReasonNotes?: string;
}

export const jobStatusService = {
  async markJobAsLost(params: MarkJobLostParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          job_status: 'lost',
          lost_reason_category: params.lostReasonCategory,
          lost_reason_notes: params.lostReasonNotes || null,
          status_changed_by: params.userId || null,
        })
        .eq('id', params.jobId);

      if (error) {
        console.error('Error marking job as lost:', error);
        await logAction({
          actionType: 'UPDATE',
          tableName: 'jobs',
          recordId: params.jobId,
          status: 'error',
          errorMessage: error.message,
          metadata: { new_status: 'lost', reason: params.lostReasonCategory },
        });
        return { success: false, error: error.message };
      }

      await logAction({
        actionType: 'UPDATE',
        tableName: 'jobs',
        recordId: params.jobId,
        metadata: { new_status: 'lost', reason: params.lostReasonCategory },
      });

      return { success: true };
    } catch (error) {
      console.error('Unexpected error marking job as lost:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async markJobAsCancelled(params: MarkJobCancelledParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          job_status: 'cancelled',
          lost_reason_notes: params.cancellationNotes || null,
          status_changed_by: params.userId || null,
        })
        .eq('id', params.jobId);

      if (error) {
        console.error('Error marking job as cancelled:', error);
        await logAction({
          actionType: 'UPDATE',
          tableName: 'jobs',
          recordId: params.jobId,
          status: 'error',
          errorMessage: error.message,
          metadata: { new_status: 'cancelled' },
        });
        return { success: false, error: error.message };
      }

      await logAction({
        actionType: 'UPDATE',
        tableName: 'jobs',
        recordId: params.jobId,
        metadata: { new_status: 'cancelled' },
      });

      return { success: true };
    } catch (error) {
      console.error('Unexpected error marking job as cancelled:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async updateJobStatus(params: UpdateJobStatusParams): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Partial<Job> = {
        job_status: params.newStatus,
        status_changed_by: params.userId || null,
      };

      if (params.newStatus === 'lost') {
        updateData.lost_reason_category = params.lostReasonCategory || null;
        updateData.lost_reason_notes = params.lostReasonNotes || null;
      }

      if (params.newStatus === 'cancelled') {
        updateData.lost_reason_notes = params.lostReasonNotes || null;
      }

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', params.jobId);

      if (error) {
        console.error('Error updating job status:', error);
        await logAction({
          actionType: 'UPDATE',
          tableName: 'jobs',
          recordId: params.jobId,
          status: 'error',
          errorMessage: error.message,
          metadata: { new_status: params.newStatus },
        });
        return { success: false, error: error.message };
      }

      await logAction({
        actionType: 'UPDATE',
        tableName: 'jobs',
        recordId: params.jobId,
        metadata: { new_status: params.newStatus },
      });

      return { success: true };
    } catch (error) {
      console.error('Unexpected error updating job status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async getJobsByStatus(businessId: string, status: JobStatus): Promise<Job[]> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('business_id', businessId)
        .eq('job_status', status)
        .eq('is_active', true)
        .order('status_changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs by status:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching jobs by status:', error);
      return [];
    }
  },

  async getLostJobs(businessId: string): Promise<Job[]> {
    return this.getJobsByStatus(businessId, 'lost');
  },

  async getCancelledJobs(businessId: string): Promise<Job[]> {
    return this.getJobsByStatus(businessId, 'cancelled');
  },

  async getActiveJobs(businessId: string): Promise<Job[]> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('business_id', businessId)
        .in('job_status', ['quoted', 'accepted', 'scheduled', 'in_progress'])
        .eq('is_active', true)
        .order('date_quoted', { ascending: false });

      if (error) {
        console.error('Error fetching active jobs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching active jobs:', error);
      return [];
    }
  },

  getStatusLabel(status: JobStatus): string {
    const labels: Record<JobStatus, string> = {
      quoted: 'Quoted',
      accepted: 'Accepted',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      lost: 'Lost',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  },

  getStatusColor(status: JobStatus): string {
    const colors: Record<JobStatus, string> = {
      quoted: 'bg-amber-100 text-amber-800 border-amber-200',
      accepted: 'bg-blue-100 text-blue-800 border-blue-200',
      scheduled: 'bg-sky-100 text-sky-800 border-sky-200',
      in_progress: 'bg-teal-100 text-teal-800 border-teal-200',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lost: 'bg-slate-100 text-slate-500 border-slate-200',
      cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  },
};

export const LOST_REASON_CATEGORIES: LostReasonCategory[] = [
  'Price too high',
  'Went with competitor',
  'Customer decided not to proceed',
  'Timeline didn\'t work',
  'Customer unresponsive',
  'Out of service area',
  'Project scope mismatch',
  'Other',
];
