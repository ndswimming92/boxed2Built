import test from 'node:test';
import assert from 'node:assert/strict';

import {
  type TemplateDraft,
  buildSentPayload,
  placeholderIds,
  validateTemplate,
} from '../../supabase/functions/_shared/sentTemplates.ts';

const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  secret: 'SENT_TEMPLATE_BOOKING_CONFIRMED',
  category: 'UTILITY',
  body: "Boxed2Built: Hi {{0:variable}}, you're confirmed for {{1:variable}}. Reply STOP to opt out.",
  variables: [
    { id: 0, name: 'customerName', variableType: 'text', sample: 'Jamie' },
    { id: 1, name: 'appointmentTime', variableType: 'text', sample: 'Saturday at 10:00 AM' },
  ],
  ...overrides,
});

test('a well-formed template has no problems', () => {
  assert.deepEqual(validateTemplate(draft()), []);
});

test('placeholderIds lists variable positions in order', () => {
  assert.deepEqual(placeholderIds('a {{1:variable}} b {{0:variable}}'), [1, 0]);
});

test('an empty message is refused', () => {
  assert.deepEqual(validateTemplate(draft({ body: '   ' })), ['The message is empty.']);
});

test('the message must start with the business name and carry STOP language', () => {
  const problems = validateTemplate(draft({ body: 'Hi {{0:variable}} {{1:variable}}' }));
  assert.equal(problems.length, 2);
  assert.match(problems[0], /Boxed2Built:/);
  assert.match(problems[1], /STOP/);
});

test('a marker with no defined variable, and a variable never used, are both caught', () => {
  const problems = validateTemplate(
    draft({ body: 'Boxed2Built: Hi {{0:variable}} {{2:variable}}. Reply STOP to opt out.' }),
  );
  assert.ok(problems.some((p) => p.includes('{{2:variable}}')));
  assert.ok(problems.some((p) => p.startsWith('Variable 1 is defined')));
});

test('a curly apostrophe, long dash or emoji is refused, a plain one is not', () => {
  const curly = validateTemplate(
    draft({ body: 'Boxed2Built: Hi {{0:variable}}, you’re confirmed for {{1:variable}}. Reply STOP to opt out.' }),
  );
  assert.equal(curly.length, 1);
  assert.match(curly[0], /standard SMS alphabet/);
  assert.deepEqual(validateTemplate(draft()), []);
});

test('a variable used twice is refused', () => {
  const problems = validateTemplate(
    draft({ body: 'Boxed2Built: {{0:variable}} {{0:variable}} {{1:variable}} Reply STOP to opt out.' }),
  );
  assert.ok(problems.some((p) => p.includes('more than once')));
});

test('variables need a one-word name and a sample', () => {
  const problems = validateTemplate(
    draft({
      variables: [
        { id: 0, name: 'customer name', variableType: 'text', sample: 'Jamie' },
        { id: 1, name: 'appointmentTime', variableType: 'text', sample: ' ' },
      ],
    }),
  );
  assert.ok(problems.some((p) => p.includes('one-word name')));
  assert.ok(problems.some((p) => p.includes('sample value')));
});

test('the Sent payload matches what create-sent-templates.mjs sends', () => {
  const payload = buildSentPayload(draft({ body: `  ${draft().body}  ` }));
  assert.equal(payload.category, 'UTILITY');
  assert.equal(payload.language, 'en_US');
  assert.equal(payload.submit_for_review, true);
  const { multiChannel } = payload.definition.body;
  assert.equal(multiChannel.type, 'text');
  assert.equal(multiChannel.template, draft().body);
  assert.deepEqual(multiChannel.variables[1], {
    id: 1,
    name: 'appointmentTime',
    type: 'variable',
    props: { variableType: 'text', sample: 'Saturday at 10:00 AM' },
  });
});
