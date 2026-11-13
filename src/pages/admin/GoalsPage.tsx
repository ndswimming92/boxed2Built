import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Plus, RotateCcw, Search, Target, Trash2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Goal } from '../../lib/supabase';
import { completeGoal, createGoal, deleteGoal, getGoals, reopenGoal, updateGoal } from '../../services/goalsService';
import {
  CATEGORY_LABELS,
  daysUntil,
  dueCountdown,
  formatDate,
  groupByUrgency,
  isCheckboxGoal,
  isDone,
  matchesSearch,
  progressPercent,
  progressSummary,
  sortDone,
  toISODate,
  type UrgencyKey,
} from '../../lib/goalHelpers';

type Tab = 'active' | 'completed';
type SaveState = 'idle' | 'saving' | 'saved';

interface Toast {
  text: string;
  tone: 'success' | 'error';
  undo?: () => void;
}

const PRIORITIES: { value: Goal['priority']; label: string; dot: string }[] = [
  { value: 'high', label: 'High', dot: 'bg-red-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-500' },
  { value: 'low', label: 'Low', dot: 'bg-slate-400' },
];

const UNITS: { value: Goal['unit_type']; label: string }[] = [
  { value: 'revenue', label: 'Dollars ($)' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'hours', label: 'Hours' },
  { value: 'percentage', label: 'Percent (%)' },
  { value: 'custom', label: 'Something else' },
];

const GROUP_TONE: Record<UrgencyKey, string> = {
  overdue: 'text-red-700',
  soon: 'text-amber-700',
  later: 'text-slate-600',
  none: 'text-slate-600',
};

const fieldBase =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const field = `w-full ${fieldBase}`;
const fieldLabel = 'mb-1 block text-xs font-medium text-slate-600';

export default function GoalsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((next: Toast) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), next.undo ? 8000 : 4000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(() => {
    fetchGoals()
      .then((result) => {
        setBusinessId(result.businessId);
        setGoals(result.goals);
        setLoadFailed(false);
      })
      .catch((error) => {
        console.error('Error loading goals:', error);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const replaceGoal = (saved: Goal) => setGoals((list) => list.map((g) => (g.id === saved.id ? saved : g)));

  // Saves to one goal run one after another. Leaving a field and clicking
  // "Mark complete" in the same motion starts two writes; unordered, the field
  // save could land last and quietly put a finished goal back to in progress.
  const queues = useRef(new Map<string, Promise<unknown>>());
  const waiting = useRef(new Map<string, number>());
  const enqueue = <T,>(id: string, task: () => Promise<T>): Promise<T> => {
    waiting.current.set(id, (waiting.current.get(id) ?? 0) + 1);
    const run = (queues.current.get(id) ?? Promise.resolve()).catch(() => undefined).then(task);
    queues.current.set(id, run);
    return run.finally(() => waiting.current.set(id, (waiting.current.get(id) ?? 1) - 1));
  };
  const isSettled = (id: string) => (waiting.current.get(id) ?? 0) === 0;

  /** Saves a change straight away; the list updates first and rolls back if the save fails. */
  const patchGoal = async (goal: Goal, changes: Partial<Goal>) => {
    setGoals((list) => list.map((g) => (g.id === goal.id ? { ...g, ...changes } : g)));
    setSaveState('saving');
    try {
      const saved = await enqueue(goal.id, () => updateGoal(goal.id, changes));
      // A reply to an earlier save does not know about edits made since.
      if (isSettled(goal.id)) {
        replaceGoal(saved);
        setSaveState('saved');
      }
    } catch {
      const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, goal[key as keyof Goal]]));
      setGoals((list) => list.map((g) => (g.id === goal.id ? { ...g, ...previous } : g)));
      setSaveState('idle');
      showToast({ tone: 'error', text: 'That change could not be saved. Please try again.' });
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !businessId || adding) return;
    setAdding(true);
    try {
      const created = await createGoal(businessId, {
        title,
        target_value: 1,
        unit_type: 'custom',
        start_date: toISODate(new Date()),
      });
      setGoals((list) => [...list, created]);
      setNewTitle('');
      setTab('active');
      setSaveState('idle');
      setExpandedId(created.id);
    } catch {
      showToast({ tone: 'error', text: 'The goal could not be added. Please try again.' });
    } finally {
      setAdding(false);
    }
  };

  const handleReopen = async (goal: Goal, quiet = false) => {
    try {
      replaceGoal(await enqueue(goal.id, () => reopenGoal(goal)));
      if (!quiet) showToast({ tone: 'success', text: `"${goal.title}" is back on your active list.` });
    } catch {
      showToast({ tone: 'error', text: 'The goal could not be reopened. Please try again.' });
    }
  };

  const handleComplete = async (goal: Goal) => {
    try {
      const saved = await enqueue(goal.id, () => completeGoal(goal.id, isCheckboxGoal(goal) ? goal.target_value : undefined));
      replaceGoal(saved);
      if (expandedId === goal.id) setExpandedId(null);
      showToast({
        tone: 'success',
        text: `"${goal.title}" completed and moved to the Completed tab.`,
        undo: () => {
          setToast(null);
          handleReopen(saved, true);
        },
      });
    } catch {
      showToast({ tone: 'error', text: 'The goal could not be completed. Please try again.' });
    }
  };

  const handleDelete = async (goal: Goal) => {
    if (!confirm(`Delete "${goal.title}"? This removes it from both tabs.`)) return;
    try {
      await deleteGoal(goal.id);
      setGoals((list) => list.filter((g) => g.id !== goal.id));
      showToast({ tone: 'success', text: 'Goal deleted.' });
    } catch {
      showToast({ tone: 'error', text: 'The goal could not be deleted. Please try again.' });
    }
  };

  const toggleExpanded = (id: string) => {
    setSaveState('idle');
    setExpandedId((current) => (current === id ? null : id));
  };

  const activeGoals = useMemo(() => goals.filter((g) => !isDone(g)), [goals]);
  const doneGoals = useMemo(() => goals.filter(isDone), [goals]);
  const overdueCount = activeGoals.filter((g) => (daysUntil(g.due_date) ?? 0) < 0).length;

  const passesFilters = (goal: Goal) =>
    matchesSearch(goal, search) &&
    (priorityFilter === 'all' || goal.priority === priorityFilter) &&
    (categoryFilter === 'all' || goal.category === categoryFilter);

  const visibleActive = activeGoals.filter(passesFilters);
  const visibleDone = sortDone(doneGoals.filter(passesFilters));
  const groups = groupByUrgency(visibleActive);
  const filtering = search.trim() !== '' || priorityFilter !== 'all' || categoryFilter !== 'all';
  const otherTabMatches = filtering ? (tab === 'active' ? visibleDone.length : visibleActive.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600" role="status" aria-label="Loading goals" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Target className="h-7 w-7 shrink-0 text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Business Goals</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {activeGoals.length === 0
            ? 'Nothing in progress right now.'
            : `${activeGoals.length} in progress`}
          {overdueCount > 0 && <span className="font-medium text-red-700"> · {overdueCount} overdue</span>}
        </p>
      </header>

      {loadFailed && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">Your goals could not be loaded.</p>
          <button onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100">
            Try again
          </button>
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <label htmlFor="new-goal" className="sr-only">
          New goal
        </label>
        <input
          id="new-goal"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a goal, e.g. Get general liability insurance"
          className={`${field} py-2.5 text-base`}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || adding || !businessId}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
          Add<span className="hidden sm:inline"> goal</span>
        </button>
      </form>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Goals" className="inline-flex self-start rounded-lg bg-slate-200/70 p-1">
          {([
            ['active', 'Active', activeGoals.length],
            ['completed', 'Completed', doneGoals.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setExpandedId(null);
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label} <span className="ml-1 tabular-nums text-slate-500">{count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1 sm:w-52 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search goals"
              placeholder="Search goals"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${field} pl-8`}
            />
          </div>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={fieldBase}>
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={fieldBase}>
            <option value="all">Any category</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'active' ? (
        groups.length === 0 ? (
          <EmptyState
            title={filtering ? 'No active goals match' : 'No active goals'}
            body={
              filtering
                ? 'Try a different search or filter.'
                : doneGoals.length > 0
                ? 'Everything is done. Add your next goal above.'
                : 'Type your first goal in the box above and press Enter.'
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${GROUP_TONE[group.key]}`}>
                  {group.label} <span className="font-normal text-slate-500">· {group.goals.length}</span>
                </h2>
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {group.goals.map((goal) => (
                    <ActiveGoalRow
                      key={goal.id}
                      goal={goal}
                      expanded={expandedId === goal.id}
                      saveState={expandedId === goal.id ? saveState : 'idle'}
                      onToggle={() => toggleExpanded(goal.id)}
                      onPatch={(changes) => patchGoal(goal, changes)}
                      onComplete={() => handleComplete(goal)}
                      onDelete={() => handleDelete(goal)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : visibleDone.length === 0 ? (
        <EmptyState
          title={filtering ? 'No completed goals match' : 'Nothing completed yet'}
          body={filtering ? 'Try a different search or filter.' : 'Goals you finish move here, so you can always look back at them.'}
        />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visibleDone.map((goal) => (
            <DoneGoalRow key={goal.id} goal={goal} onReopen={() => handleReopen(goal)} onDelete={() => handleDelete(goal)} />
          ))}
        </ul>
      )}

      {otherTabMatches > 0 && (
        <button
          onClick={() => setTab(tab === 'active' ? 'completed' : 'active')}
          className="mt-4 text-sm font-medium text-emerald-700 hover:underline"
        >
          {otherTabMatches} more {otherTabMatches === 1 ? 'match' : 'matches'} in {tab === 'active' ? 'Completed' : 'Active'}
        </button>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            className={`pointer-events-auto flex max-w-lg items-center gap-4 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
              toast.tone === 'error' ? 'bg-red-700' : 'bg-slate-900'
            }`}
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <button onClick={toast.undo} className="shrink-0 font-semibold text-emerald-300 hover:text-emerald-200">
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchGoals(): Promise<{ businessId: string | null; goals: Goal[] }> {
  const { data, error } = await supabase.from('business_info').select('id').eq('is_active', true).maybeSingle();
  if (error) throw error;
  const businessId: string | null = data?.id ?? null;
  return { businessId, goals: businessId ? await getGoals(businessId) : [] };
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Target className="mx-auto mb-3 h-10 w-10 text-slate-300" />
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

function PriorityTag({ priority }: { priority: Goal['priority'] }) {
  const meta = PRIORITIES.find((p) => p.value === priority) ?? PRIORITIES[1];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label} priority
    </span>
  );
}

interface ActiveRowProps {
  goal: Goal;
  expanded: boolean;
  saveState: SaveState;
  onToggle: () => void;
  onPatch: (changes: Partial<Goal>) => void;
  onComplete: () => void;
  onDelete: () => void;
}

function ActiveGoalRow({ goal, expanded, saveState, onToggle, onPatch, onComplete, onDelete }: ActiveRowProps) {
  const days = daysUntil(goal.due_date);
  const checkbox = isCheckboxGoal(goal);
  const percent = progressPercent(goal);
  const dueTone = days === null ? 'text-slate-500' : days < 0 ? 'font-medium text-red-700' : days <= 14 ? 'font-medium text-amber-700' : 'text-slate-600';

  return (
    <li className={expanded ? 'bg-slate-50/60' : ''}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <button
          onClick={onComplete}
          aria-label={`Mark "${goal.title}" complete`}
          title="Mark complete"
          className="group mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-emerald-600 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Check className="h-3.5 w-3.5 text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={3} />
        </button>

        <button onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-start gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900">{goal.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              {goal.due_date && days !== null ? (
                <span className={dueTone}>
                  {dueCountdown(days)}
                  <span className="font-normal text-slate-500"> · {formatDate(goal.due_date)}</span>
                </span>
              ) : (
                <span className="text-slate-500">No due date</span>
              )}
              <PriorityTag priority={goal.priority} />
            </span>
            {!checkbox && (
              <span className="mt-2 flex items-center gap-3">
                <span className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                  <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                </span>
                <span className="text-sm tabular-nums text-slate-700">
                  {progressSummary(goal)} <span className="text-slate-500">· {percent}%</span>
                </span>
              </span>
            )}
          </span>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm text-slate-500">
            <span className="hidden sm:inline">{expanded ? 'Close' : 'Edit'}</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </div>

      {expanded && <GoalEditor goal={goal} saveState={saveState} onPatch={onPatch} onComplete={onComplete} onDelete={onDelete} />}
    </li>
  );
}

interface EditorProps {
  goal: Goal;
  saveState: SaveState;
  onPatch: (changes: Partial<Goal>) => void;
  onComplete: () => void;
  onDelete: () => void;
}

/** Every field saves on its own as soon as it changes; there is no Save button. */
function GoalEditor({ goal, saveState, onPatch, onComplete, onDelete }: EditorProps) {
  const [title, setTitle] = useState(goal.title);
  const [notes, setNotes] = useState(goal.description ?? '');
  const [useNumber, setUseNumber] = useState(!isCheckboxGoal(goal));
  const [current, setCurrent] = useState(String(goal.current_value));
  const [target, setTarget] = useState(isCheckboxGoal(goal) ? '' : String(goal.target_value));
  const [unitLabel, setUnitLabel] = useState(goal.unit_label ?? '');
  const id = (name: string) => `goal-${goal.id}-${name}`;

  const saveTitle = () => {
    const next = title.trim();
    if (!next) setTitle(goal.title);
    else if (next !== goal.title) onPatch({ title: next });
  };

  const saveNumbers = () => {
    const nextTarget = parseFloat(target);
    const nextCurrent = Math.max(parseFloat(current) || 0, 0);
    if (!(nextTarget > 0)) return;
    if (nextTarget === goal.target_value && nextCurrent === goal.current_value) return;
    onPatch({
      target_value: nextTarget,
      current_value: nextCurrent,
      ...(goal.status === 'not_started' && nextCurrent > 0 ? { status: 'in_progress' as const } : {}),
    });
  };

  const chooseCheckbox = () => {
    setUseNumber(false);
    setTarget('');
    setCurrent('0');
    if (!isCheckboxGoal(goal)) onPatch({ target_value: 1, current_value: 0, unit_type: 'custom', unit_label: null });
  };

  const chooseUnit = (unit: Goal['unit_type']) => {
    const changes: Partial<Goal> = { unit_type: unit, unit_label: unit === 'custom' ? unitLabel.trim() || null : null };
    if (unit === 'percentage' && !(parseFloat(target) > 0)) {
      setTarget('100');
      changes.target_value = 100;
    }
    onPatch(changes);
  };

  const typedTarget = parseFloat(target);
  const reached = useNumber && typedTarget > 0 && (parseFloat(current) || 0) >= typedTarget;
  const segment = (on: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="space-y-4 border-t border-slate-200 px-4 pb-4 pt-4 sm:pl-[3.25rem]">
      <div>
        <label htmlFor={id('title')} className={fieldLabel}>
          Goal
        </label>
        <input
          id={id('title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={field}
        />
      </div>

      <div>
        <label htmlFor={id('notes')} className={fieldLabel}>
          Notes
        </label>
        <textarea
          id={id('notes')}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (goal.description ?? '') && onPatch({ description: notes })}
          placeholder="What does done look like?"
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={id('due')} className={fieldLabel}>
            Due date
          </label>
          <input
            id={id('due')}
            type="date"
            value={goal.due_date ?? ''}
            onChange={(e) => onPatch({ due_date: e.target.value || null })}
            className={field}
          />
        </div>
        <div>
          <span className={fieldLabel} id={id('priority')}>
            Priority
          </span>
          <div role="radiogroup" aria-labelledby={id('priority')} className="flex rounded-lg bg-slate-200/70 p-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={goal.priority === p.value}
                onClick={() => goal.priority !== p.value && onPatch({ priority: p.value })}
                className={segment(goal.priority === p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor={id('category')} className={fieldLabel}>
            Category
          </label>
          <select id={id('category')} value={goal.category} onChange={(e) => onPatch({ category: e.target.value as Goal['category'] })} className={field}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={fieldLabel} id={id('tracking')}>
          How do you track it?
        </span>
        <div role="radiogroup" aria-labelledby={id('tracking')} className="flex max-w-sm rounded-lg bg-slate-200/70 p-1">
          <button type="button" role="radio" aria-checked={!useNumber} onClick={chooseCheckbox} className={segment(!useNumber)}>
            Done / not done
          </button>
          <button type="button" role="radio" aria-checked={useNumber} onClick={() => setUseNumber(true)} className={segment(useNumber)}>
            Toward a number
          </button>
        </div>

        {useNumber && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={id('current')} className={fieldLabel}>
                So far
              </label>
              <input id={id('current')} type="number" min="0" step="any" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} onBlur={saveNumbers} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={field} />
            </div>
            <div>
              <label htmlFor={id('target')} className={fieldLabel}>
                Target
              </label>
              <input id={id('target')} type="number" min="0" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={saveNumbers} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} placeholder="e.g. 5000" className={field} />
            </div>
            <div>
              <label htmlFor={id('unit')} className={fieldLabel}>
                Counted in
              </label>
              <select id={id('unit')} value={goal.unit_type} onChange={(e) => chooseUnit(e.target.value as Goal['unit_type'])} className={field}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            {goal.unit_type === 'custom' && (
              <div className="sm:col-span-3 sm:max-w-xs">
                <label htmlFor={id('unit-label')} className={fieldLabel}>
                  What are you counting?
                </label>
                <input
                  id={id('unit-label')}
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  onBlur={() => (unitLabel.trim() || null) !== (goal.unit_label || null) && onPatch({ unit_label: unitLabel.trim() || null })}
                  placeholder="e.g. reviews, visitors per day"
                  className={field}
                />
              </div>
            )}
            {!(typedTarget > 0) && <p className="text-xs text-slate-500 sm:col-span-3">Enter a target to start tracking progress.</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500" aria-live="polite">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : 'Changes save automatically'}
          </span>
          <button onClick={onComplete} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Check className="h-4 w-4" />
            {reached ? 'Target reached — mark complete' : 'Mark complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneGoalRow({ goal, onReopen, onDelete }: { goal: Goal; onReopen: () => void; onDelete: () => void }) {
  const cancelled = goal.status === 'cancelled';
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      {cancelled ? (
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-slate-400" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{goal.title}</p>
        <p className="mt-1 text-sm text-slate-600">
          {cancelled ? 'Cancelled' : goal.completion_date ? `Completed ${formatDate(goal.completion_date)}` : 'Completed'}
          <span className="text-slate-500"> · {CATEGORY_LABELS[goal.category] ?? goal.category}</span>
          {!isCheckboxGoal(goal) && <span className="text-slate-500"> · {progressSummary(goal)}</span>}
        </p>
        {goal.description && <p className="mt-1 text-sm text-slate-500">{goal.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onReopen} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100" aria-label={`Reopen "${goal.title}"`}>
          <RotateCcw className="h-4 w-4" />
          Reopen
        </button>
        <button onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete "${goal.title}"`} title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
