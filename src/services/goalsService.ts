import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/supabase';
import { logAction } from './auditLogService';

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  overdueGoals: number;
  completionRate: number;
  highPriorityGoals: number;
}

export interface GoalFilters {
  status?: string;
  priority?: string;
  category?: string;
  searchQuery?: string;
}

export async function getGoals(businessId: string, filters?: GoalFilters): Promise<Goal[]> {
  let query = supabase
    .from('business_goals')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.searchQuery) {
    query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching goals:', error);
    throw error;
  }

  return data || [];
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('business_goals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching goal:', error);
    throw error;
  }

  return data;
}

export async function createGoal(businessId: string, goalData: Partial<Goal>): Promise<Goal> {
  const { data, error } = await supabase
    .from('business_goals')
    .insert({
      business_id: businessId,
      title: goalData.title,
      description: goalData.description || '',
      category: goalData.category || 'custom',
      priority: goalData.priority || 'medium',
      status: goalData.status || 'not_started',
      target_value: goalData.target_value || 0,
      current_value: goalData.current_value || 0,
      unit_type: goalData.unit_type || 'custom',
      unit_label: goalData.unit_label || null,
      start_date: goalData.start_date || null,
      due_date: goalData.due_date || null,
    })
    .select()
    .single();

  if (error) {
    await logAction({
      actionType: 'CREATE',
      tableName: 'business_goals',
      recordIdentifier: goalData.title || 'Untitled Goal',
      status: 'error',
      errorMessage: error.message,
    });
    console.error('Error creating goal:', error);
    throw error;
  }

  await logAction({
    actionType: 'CREATE',
    tableName: 'business_goals',
    recordId: data.id,
    recordIdentifier: data.title,
    newValues: data,
    status: 'success',
  });

  return data;
}

export async function updateGoal(id: string, goalData: Partial<Goal>): Promise<Goal> {
  const oldGoal = await getGoalById(id);

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (goalData.title !== undefined) updateData.title = goalData.title;
  if (goalData.description !== undefined) updateData.description = goalData.description;
  if (goalData.category !== undefined) updateData.category = goalData.category;
  if (goalData.priority !== undefined) updateData.priority = goalData.priority;
  if (goalData.status !== undefined) updateData.status = goalData.status;
  if (goalData.target_value !== undefined) updateData.target_value = goalData.target_value;
  if (goalData.current_value !== undefined) updateData.current_value = goalData.current_value;
  if (goalData.unit_type !== undefined) updateData.unit_type = goalData.unit_type;
  if (goalData.unit_label !== undefined) updateData.unit_label = goalData.unit_label;
  if (goalData.start_date !== undefined) updateData.start_date = goalData.start_date;
  if (goalData.due_date !== undefined) updateData.due_date = goalData.due_date;
  if (goalData.completion_date !== undefined) updateData.completion_date = goalData.completion_date;
  if (goalData.is_archived !== undefined) updateData.is_archived = goalData.is_archived;

  const { data, error } = await supabase
    .from('business_goals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    await logAction({
      actionType: 'UPDATE',
      tableName: 'business_goals',
      recordId: id,
      recordIdentifier: oldGoal?.title || 'Unknown Goal',
      status: 'error',
      errorMessage: error.message,
    });
    console.error('Error updating goal:', error);
    throw error;
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'business_goals',
    recordId: data.id,
    recordIdentifier: data.title,
    oldValues: oldGoal || undefined,
    newValues: updateData,
    status: 'success',
  });

  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const oldGoal = await getGoalById(id);

  const { error } = await supabase
    .from('business_goals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    await logAction({
      actionType: 'DELETE',
      tableName: 'business_goals',
      recordId: id,
      recordIdentifier: oldGoal?.title || 'Unknown Goal',
      status: 'error',
      errorMessage: error.message,
    });
    console.error('Error deleting goal:', error);
    throw error;
  }

  await logAction({
    actionType: 'DELETE',
    tableName: 'business_goals',
    recordId: id,
    recordIdentifier: oldGoal?.title || 'Unknown Goal',
    oldValues: oldGoal || undefined,
    status: 'success',
  });
}

export async function archiveGoal(id: string): Promise<void> {
  const oldGoal = await getGoalById(id);

  const { error } = await supabase
    .from('business_goals')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    await logAction({
      actionType: 'ARCHIVE',
      tableName: 'business_goals',
      recordId: id,
      recordIdentifier: oldGoal?.title || 'Unknown Goal',
      status: 'error',
      errorMessage: error.message,
    });
    console.error('Error archiving goal:', error);
    throw error;
  }

  await logAction({
    actionType: 'ARCHIVE',
    tableName: 'business_goals',
    recordId: id,
    recordIdentifier: oldGoal?.title || 'Unknown Goal',
    status: 'success',
  });
}

export async function completeGoal(id: string): Promise<Goal> {
  const oldGoal = await getGoalById(id);

  const { data, error } = await supabase
    .from('business_goals')
    .update({
      status: 'completed',
      completion_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    await logAction({
      actionType: 'UPDATE',
      tableName: 'business_goals',
      recordId: id,
      recordIdentifier: oldGoal?.title || 'Unknown Goal',
      status: 'error',
      errorMessage: error.message,
      metadata: { action: 'complete' },
    });
    console.error('Error completing goal:', error);
    throw error;
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'business_goals',
    recordId: data.id,
    recordIdentifier: data.title,
    oldValues: oldGoal || undefined,
    newValues: { status: 'completed', completion_date: data.completion_date },
    status: 'success',
    metadata: { action: 'complete' },
  });

  return data;
}

export async function updateGoalProgress(id: string, currentValue: number): Promise<Goal> {
  const { data, error } = await supabase
    .from('business_goals')
    .update({
      current_value: currentValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal progress:', error);
    throw error;
  }

  return data;
}

export async function getGoalStats(businessId: string): Promise<GoalStats> {
  const { data: goals, error } = await supabase
    .from('business_goals')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_archived', false);

  if (error) {
    console.error('Error fetching goal stats:', error);
    return {
      totalGoals: 0,
      activeGoals: 0,
      completedGoals: 0,
      overdueGoals: 0,
      completionRate: 0,
      highPriorityGoals: 0,
    };
  }

  const totalGoals = goals?.length || 0;
  const activeGoals = goals?.filter(g => g.status === 'in_progress' || g.status === 'not_started').length || 0;
  const completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
  const overdueGoals = goals?.filter(g => g.status === 'overdue').length || 0;
  const highPriorityGoals = goals?.filter(g => g.priority === 'high' && g.status !== 'completed' && g.status !== 'cancelled').length || 0;
  const completionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

  return {
    totalGoals,
    activeGoals,
    completedGoals,
    overdueGoals,
    completionRate: Math.round(completionRate * 10) / 10,
    highPriorityGoals,
  };
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function getUpcomingGoals(businessId: string, limit: number = 5): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('business_goals')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .in('status', ['not_started', 'in_progress', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming goals:', error);
    return [];
  }

  return (data || []).sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority] ?? 99;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 99;
    return aPriority - bPriority;
  });
}

export async function updateOverdueGoals(): Promise<void> {
  const { error } = await supabase.rpc('update_overdue_goals');

  if (error) {
    console.error('Error updating overdue goals:', error);
  }
}
