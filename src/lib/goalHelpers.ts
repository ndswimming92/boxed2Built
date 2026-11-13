import type { Goal } from './supabase';

/**
 * Pure helpers behind the Business Goals page: which goals are finished, how
 * urgent the rest are, and how their dates and values read.
 */

export type UrgencyKey = 'overdue' | 'soon' | 'later' | 'none';

export interface GoalGroup {
  key: UrgencyKey;
  label: string;
  goals: Goal[];
}

/** A goal due within this many days counts as "due soon". */
export const DUE_SOON_DAYS = 14;

const DAY_MS = 86_400_000;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const GROUP_LABELS: Record<UrgencyKey, string> = {
  overdue: 'Overdue',
  soon: 'Due in the next 2 weeks',
  later: 'Later',
  none: 'No due date',
};

export const CATEGORY_LABELS: Record<Goal['category'], string> = {
  financial: 'Financial',
  operational: 'Operational',
  growth: 'Growth',
  customer_satisfaction: 'Customer Satisfaction',
  custom: 'Other',
};

/**
 * Parses a `YYYY-MM-DD` date as a local calendar day. `new Date('2026-03-31')`
 * is midnight UTC, which is still March 30 anywhere west of Greenwich.
 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from today until the due date; negative once it has passed. */
export function daysUntil(dueDate: string | null, today: Date = new Date()): number | null {
  if (!dueDate) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parseLocalDate(dueDate).getTime() - start.getTime()) / DAY_MS);
}

/** Finished goals leave the active list: completed, cancelled or archived. */
export function isDone(goal: Pick<Goal, 'status' | 'is_archived'>): boolean {
  return goal.status === 'completed' || goal.status === 'cancelled' || goal.is_archived;
}

/**
 * A goal with a target of one ("1 Bought") is a yes/no item, shown as a
 * checkbox rather than a progress bar.
 */
export function isCheckboxGoal(goal: Pick<Goal, 'target_value' | 'unit_type'>): boolean {
  return goal.target_value === 1 && goal.unit_type !== 'revenue' && goal.unit_type !== 'percentage';
}

export function urgencyOf(goal: Pick<Goal, 'due_date'>, today: Date = new Date()): UrgencyKey {
  const days = daysUntil(goal.due_date, today);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  return days <= DUE_SOON_DAYS ? 'soon' : 'later';
}

/** Active goals bucketed by urgency, soonest first, higher priority breaking ties. */
export function groupByUrgency(goals: Goal[], today: Date = new Date()): GoalGroup[] {
  const buckets: Record<UrgencyKey, Goal[]> = { overdue: [], soon: [], later: [], none: [] };
  for (const goal of goals) buckets[urgencyOf(goal, today)].push(goal);

  const byDueThenPriority = (a: Goal, b: Goal) =>
    (a.due_date ?? '').localeCompare(b.due_date ?? '') ||
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    a.title.localeCompare(b.title);

  return (['overdue', 'soon', 'later', 'none'] as UrgencyKey[])
    .map((key) => ({ key, label: GROUP_LABELS[key], goals: buckets[key].sort(byDueThenPriority) }))
    .filter((group) => group.goals.length > 0);
}

/** Finished goals, most recently finished first. */
export function sortDone(goals: Goal[]): Goal[] {
  const finishedOn = (g: Goal) => g.completion_date ?? g.updated_at?.slice(0, 10) ?? '';
  return [...goals].sort((a, b) => finishedOn(b).localeCompare(finishedOn(a)));
}

export function formatDate(value: string, today: Date = new Date()): string {
  const date = parseLocalDate(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** "Due today", "3 days left", "12 days overdue". */
export function dueCountdown(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  return days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`;
}

export function formatGoalValue(
  value: number,
  unitType: Goal['unit_type'],
  unitLabel: string | null,
): string {
  const n = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  switch (unitType) {
    case 'revenue':
      return `$${n}`;
    case 'jobs':
      return `${n} ${value === 1 ? 'job' : 'jobs'}`;
    case 'hours':
      return `${n} ${value === 1 ? 'hour' : 'hours'}`;
    case 'percentage':
      return `${n}%`;
    default:
      return unitLabel ? `${n} ${unitLabel}` : n;
  }
}

/** Progress from the values themselves, so it is right before the server replies. */
export function progressPercent(goal: Pick<Goal, 'current_value' | 'target_value'>): number {
  if (!(goal.target_value > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)));
}

/** "$250 of $750" */
export function progressSummary(goal: Pick<Goal, 'current_value' | 'target_value' | 'unit_type' | 'unit_label'>): string {
  const current = formatGoalValue(goal.current_value, goal.unit_type, null);
  return `${current} of ${formatGoalValue(goal.target_value, goal.unit_type, goal.unit_label)}`;
}

export function matchesSearch(goal: Pick<Goal, 'title' | 'description'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return goal.title.toLowerCase().includes(q) || (goal.description ?? '').toLowerCase().includes(q);
}
