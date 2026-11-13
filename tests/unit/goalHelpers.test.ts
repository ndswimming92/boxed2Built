import test from 'node:test';
import assert from 'node:assert/strict';

import {
  daysUntil,
  dueCountdown,
  formatGoalValue,
  groupByUrgency,
  isCheckboxGoal,
  isDone,
  parseLocalDate,
  progressPercent,
  progressSummary,
} from '../../src/lib/goalHelpers.ts';

const TODAY = new Date(2026, 10, 13); // Nov 13, 2026, local time

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const goal = (overrides: Record<string, unknown>): any => ({
  title: 'Goal',
  priority: 'medium',
  status: 'in_progress',
  is_archived: false,
  due_date: null,
  target_value: 1,
  current_value: 0,
  unit_type: 'custom',
  unit_label: null,
  ...overrides,
});

test('a due date is read as a local calendar day, not midnight UTC', () => {
  const d = parseLocalDate('2026-03-31');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 2, 31]);
});

test('days until due counts whole calendar days whatever the time of day', () => {
  const lateEvening = new Date(2026, 10, 13, 23, 30);
  assert.equal(daysUntil('2026-11-13', lateEvening), 0);
  assert.equal(daysUntil('2026-11-14', lateEvening), 1);
  assert.equal(daysUntil('2026-11-10', TODAY), -3);
  assert.equal(daysUntil(null, TODAY), null);
});

test('countdown wording', () => {
  assert.equal(dueCountdown(0), 'Due today');
  assert.equal(dueCountdown(1), 'Due tomorrow');
  assert.equal(dueCountdown(9), '9 days left');
  assert.equal(dueCountdown(-1), '1 day overdue');
  assert.equal(dueCountdown(-227), '227 days overdue');
});

test('completed, cancelled and archived goals are all finished', () => {
  assert.equal(isDone(goal({ status: 'completed' })), true);
  assert.equal(isDone(goal({ status: 'cancelled' })), true);
  assert.equal(isDone(goal({ is_archived: true })), true);
  assert.equal(isDone(goal({ status: 'overdue' })), false);
});

test('a target of one is a yes/no goal, except for dollars and percent', () => {
  assert.equal(isCheckboxGoal(goal({ unit_label: 'Bought' })), true);
  assert.equal(isCheckboxGoal(goal({ target_value: 12 })), false);
  assert.equal(isCheckboxGoal(goal({ unit_type: 'revenue' })), false);
});

test('goals group by urgency, soonest first, priority breaking ties', () => {
  const groups = groupByUrgency(
    [
      goal({ title: 'someday' }),
      goal({ title: 'later', due_date: '2026-12-31' }),
      goal({ title: 'soon-low', due_date: '2026-11-20', priority: 'low' }),
      goal({ title: 'soon-high', due_date: '2026-11-20', priority: 'high' }),
      goal({ title: 'today', due_date: '2026-11-13' }),
      goal({ title: 'late', due_date: '2026-03-31' }),
    ],
    TODAY,
  );
  assert.deepEqual(
    groups.map((g) => [g.key, g.goals.map((x) => x.title)]),
    [
      ['overdue', ['late']],
      ['soon', ['today', 'soon-high', 'soon-low']],
      ['later', ['later']],
      ['none', ['someday']],
    ],
  );
});

test('empty groups are left out', () => {
  assert.deepEqual(groupByUrgency([goal({})], TODAY).map((g) => g.key), ['none']);
});

test('values and progress read naturally', () => {
  assert.equal(formatGoalValue(1250, 'revenue', null), '$1,250');
  assert.equal(formatGoalValue(1, 'jobs', null), '1 job');
  assert.equal(formatGoalValue(6, 'custom', 'visitors'), '6 visitors');
  assert.equal(progressSummary(goal({ current_value: 6, target_value: 12, unit_label: 'visitors' })), '6 of 12 visitors');
  assert.equal(progressPercent(goal({ current_value: 250, target_value: 750 })), 33);
  assert.equal(progressPercent(goal({ current_value: 900, target_value: 750 })), 100);
  assert.equal(progressPercent(goal({ target_value: 0 })), 0);
});
