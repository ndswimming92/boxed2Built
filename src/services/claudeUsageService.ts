import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface ClaudeUsageTrendPoint {
  date: string;
  cost_usd: number;
}

export interface ClaudeModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
}

export interface ClaudeUsage {
  fetched_at: string;
  budget_usd: number;
  spent_this_month_usd: number;
  remaining_usd: number;
  percent_used: number | null;
  trend: ClaudeUsageTrendPoint[];
  by_model: ClaudeModelUsage[];
}

export async function getClaudeUsage(): Promise<ClaudeUsage> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/get-claude-usage`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load Claude usage');
  return body as ClaudeUsage;
}

export async function updateClaudeUsageBudget(monthlyBudgetUsd: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('claude_usage_settings')
    .update({
      monthly_budget_usd: monthlyBudgetUsd,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    })
    .eq('id', true);

  if (error) throw new Error(error.message);
}
