import { supabase, Contractor, JobContractor, JobContractorWithContractor } from '../lib/supabase';

export interface ContractorWithTotals extends Contractor {
  total_paid: number;
  job_count: number;
}

/** ── Contractor directory ─────────────────────────────────────────────────── */

export async function getContractors(businessId: string): Promise<Contractor[]> {
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching contractors:', error);
    return [];
  }

  return data || [];
}

export async function createContractor(contractor: Partial<Contractor>): Promise<Contractor | null> {
  const { data, error } = await supabase
    .from('contractors')
    .insert([contractor])
    .select()
    .single();

  if (error) {
    console.error('Error creating contractor:', error);
    throw error;
  }

  return data;
}

export async function updateContractor(id: string, updates: Partial<Contractor>): Promise<Contractor | null> {
  const { data, error } = await supabase
    .from('contractors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating contractor:', error);
    throw error;
  }

  return data;
}

/** Soft delete a contractor. Historical job assignments are preserved. */
export async function deleteContractor(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('contractors')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting contractor:', error);
    return false;
  }

  return true;
}

/**
 * Contractor directory with lifetime totals (amount paid + number of jobs).
 */
export async function getContractorsWithTotals(businessId: string): Promise<ContractorWithTotals[]> {
  const contractors = await getContractors(businessId);
  if (contractors.length === 0) return [];

  const { data: assignments, error } = await supabase
    .from('job_contractors')
    .select('contractor_id, amount_paid, job_id')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching contractor totals:', error);
    return contractors.map((c) => ({ ...c, total_paid: 0, job_count: 0 }));
  }

  const totals = new Map<string, { total: number; jobs: Set<string> }>();
  for (const row of assignments || []) {
    if (!row.contractor_id) continue;
    const entry = totals.get(row.contractor_id) || { total: 0, jobs: new Set<string>() };
    entry.total += Number(row.amount_paid) || 0;
    if (row.job_id) entry.jobs.add(row.job_id);
    totals.set(row.contractor_id, entry);
  }

  return contractors.map((c) => {
    const entry = totals.get(c.id);
    return {
      ...c,
      total_paid: entry?.total || 0,
      job_count: entry ? entry.jobs.size : 0,
    };
  });
}

/** ── Job ⇄ contractor assignments ─────────────────────────────────────────── */

export async function getJobContractors(jobId: string): Promise<JobContractorWithContractor[]> {
  const { data, error } = await supabase
    .from('job_contractors')
    .select('*, contractor:contractors(*)')
    .eq('job_id', jobId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching job contractors:', error);
    return [];
  }

  return data || [];
}

/**
 * Total contractor pay per job, keyed by job_id. Used to fold contractor cost
 * into profitability metrics on the Jobs page.
 */
export async function getJobContractorTotals(businessId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('job_contractors')
    .select('job_id, amount_paid')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching job contractor totals:', error);
    return {};
  }

  const totals: Record<string, number> = {};
  for (const row of data || []) {
    if (!row.job_id) continue;
    totals[row.job_id] = (totals[row.job_id] || 0) + (Number(row.amount_paid) || 0);
  }

  return totals;
}

export async function addJobContractor(assignment: Partial<JobContractor>): Promise<JobContractor | null> {
  const { data, error } = await supabase
    .from('job_contractors')
    .insert([assignment])
    .select()
    .single();

  if (error) {
    console.error('Error adding job contractor:', error);
    throw error;
  }

  return data;
}

export async function updateJobContractor(id: string, updates: Partial<JobContractor>): Promise<JobContractor | null> {
  const { data, error } = await supabase
    .from('job_contractors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating job contractor:', error);
    throw error;
  }

  return data;
}

export async function removeJobContractor(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('job_contractors')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error removing job contractor:', error);
    return false;
  }

  return true;
}
