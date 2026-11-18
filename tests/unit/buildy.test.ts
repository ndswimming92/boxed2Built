import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_BOARD,
  enqueueReaction,
  formatPayment,
  isFreshPayment,
  leadReaction,
  MAX_QUEUED,
  paceFor,
  paidReaction,
  pokeLine,
  pokeLines,
  seasonalLook,
  timeOfDayProp,
  doneReaction,
  type BuildyReaction,
} from '../../src/utils/buildy.ts';
import { summarizeJobBoard } from '../../src/utils/nextJob.ts';

const at = (month: number, day: number, hour: number) => new Date(2026, month, day, hour, 0);

test('coffee in the morning, lunch at midday, headlamp after dark, nothing mid-afternoon', () => {
  assert.equal(timeOfDayProp(at(3, 1, 4)), 'headlamp');
  assert.equal(timeOfDayProp(at(3, 1, 5)), 'coffee');
  assert.equal(timeOfDayProp(at(3, 1, 10)), 'coffee');
  assert.equal(timeOfDayProp(at(3, 1, 11)), 'lunch');
  assert.equal(timeOfDayProp(at(3, 1, 13)), 'lunch');
  assert.equal(timeOfDayProp(at(3, 1, 14)), null);
  assert.equal(timeOfDayProp(at(3, 1, 17)), null);
  assert.equal(timeOfDayProp(at(3, 1, 18)), 'headlamp');
  assert.equal(timeOfDayProp(at(3, 1, 23)), 'headlamp');
});

test('Santa hat in December, pumpkin in October, shades in summer, plain otherwise', () => {
  assert.equal(seasonalLook(at(11, 24, 12)), 'santa');
  assert.equal(seasonalLook(at(9, 31, 12)), 'pumpkin');
  assert.equal(seasonalLook(at(5, 1, 12)), 'shades');
  assert.equal(seasonalLook(at(7, 31, 12)), 'shades');
  assert.equal(seasonalLook(at(8, 1, 12)), null);
  assert.equal(seasonalLook(at(0, 15, 12)), null);
  assert.equal(seasonalLook(at(10, 18, 12)), null);
});

test('naps through an empty week, hurries on a packed day', () => {
  assert.equal(paceFor({ today: 0, week: 0 }), 'nap');
  assert.equal(paceFor({ today: 0, week: 2 }), 'normal');
  assert.equal(paceFor({ today: 2, week: 4 }), 'normal');
  assert.equal(paceFor({ today: 3, week: 3 }), 'busy');
});

test('poke lines lead with the real numbers, then cycle through jokes', () => {
  const board = { upcoming: 4, today: 2, week: 3, nextJobId: 'a' };
  const lines = pokeLines(board);
  assert.equal(lines[0], '4 jobs on the board.');
  assert.equal(lines[1], "2 jobs today. Let's go!");
  assert.ok(lines.length > 4);
  assert.equal(pokeLine(board, lines.length), lines[0]);
  assert.equal(pokeLine(board, -1), lines[lines.length - 1]);

  assert.equal(pokeLines(EMPTY_BOARD)[0], 'Board is clear. Nap time?');
  assert.equal(pokeLines({ upcoming: 1, today: 0, week: 1, nextJobId: 'a' })[1], '1 job this week.');
});

const r = (key: string, kind: BuildyReaction['kind']): BuildyReaction => ({ key, kind, text: key });

test('the queue drops duplicates and caps its length', () => {
  let q = enqueueReaction([], r('lead:1', 'lead'));
  assert.equal(enqueueReaction(q, r('lead:1', 'lead')), q);
  q = enqueueReaction(q, r('lead:2', 'lead'));
  q = enqueueReaction(q, r('paid:1', 'paid'));
  assert.equal(q.length, MAX_QUEUED);
  assert.equal(enqueueReaction(q, r('done:1', 'done')).length, MAX_QUEUED);
});

test('a business event jumps waiting pokes but never the one on stage', () => {
  let q = enqueueReaction([], r('poke:0', 'poke'));
  q = enqueueReaction(q, r('lead:1', 'lead'));
  assert.deepEqual(q.map((x) => x.key), ['poke:0', 'lead:1']);

  q = [r('lead:1', 'lead'), r('poke:1', 'poke')];
  q = enqueueReaction(q, r('paid:1', 'paid'));
  assert.deepEqual(q.map((x) => x.key), ['lead:1', 'paid:1', 'poke:1']);
});

test('a new poke replaces a waiting one instead of stacking', () => {
  let q = [r('lead:1', 'lead'), r('poke:1', 'poke')];
  q = enqueueReaction(q, r('poke:2', 'poke'));
  assert.deepEqual(q.map((x) => x.key), ['lead:1', 'poke:2']);
});

test('reactions link to the right place and use first names only', () => {
  const lead = leadReaction({ id: 'abc', client_name: '  Jamie Rivera ' });
  assert.equal(lead.text, 'New lead: Jamie!');
  assert.equal(lead.href, '/admin/inquiries?open=abc');
  assert.equal(leadReaction({ id: 'x', client_name: '' }).text, 'New lead!');

  assert.equal(paidReaction({ id: 'i', amount_paid: 1250 }).text, 'Paid! $1,250');
  assert.equal(paidReaction({ id: 'i', amount_paid: null }).text, 'Invoice paid!');
  assert.equal(doneReaction('j1').href, '/admin/jobs?job=j1');
});

test('money formatting drops cents on whole dollars and ignores nonsense', () => {
  assert.equal(formatPayment(84.5), '$84.50');
  assert.equal(formatPayment(200), '$200');
  assert.equal(formatPayment(0), null);
  assert.equal(formatPayment(Number.NaN), null);
});

test('only a payment from the last few minutes is news', () => {
  const now = Date.parse('2026-11-18T20:00:00Z');
  assert.equal(isFreshPayment({ status: 'paid', paid_at: '2026-11-18T19:58:00Z' }, now), true);
  assert.equal(isFreshPayment({ status: 'paid', paid_at: '2026-11-18T19:50:00Z' }, now), false);
  assert.equal(isFreshPayment({ status: 'sent', paid_at: '2026-11-18T19:59:00Z' }, now), false);
  assert.equal(isFreshPayment({ status: 'paid', paid_at: '2026-11-18T19:59:00Z', is_test: true }, now), false);
  assert.equal(isFreshPayment({ status: 'paid', paid_at: null }, now), false);
});

test('the board summary counts today and the next seven days and picks the first job', () => {
  const now = new Date(2026, 10, 18, 9, 0);
  const rows = [
    { id: 'a', date_scheduled: '2026-11-18' },
    { id: 'b', date_scheduled: '2026-11-18' },
    { id: 'c', date_scheduled: '2026-11-24' },
    { id: 'd', date_scheduled: '2026-11-25' },
    { id: 'e', date_scheduled: null },
  ];
  assert.deepEqual(summarizeJobBoard(rows, now), { upcoming: 5, today: 2, week: 3, nextJobId: 'a' });
  assert.deepEqual(summarizeJobBoard([], now), { upcoming: 0, today: 0, week: 0, nextJobId: null });
});
