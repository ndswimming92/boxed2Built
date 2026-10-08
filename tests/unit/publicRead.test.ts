import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableStatus, readWithRetry, type ReadResult } from '../../src/utils/publicRead.ts';

const ok = (): ReadResult => ({ error: null, status: 200 });
const fail = (status: number): ReadResult => ({ error: new Error(`status ${status}`), status });
const noWait = { sleep: async () => {}, random: () => 0.5 };

test('which failures are worth another try', () => {
  assert.equal(isRetryableStatus(0), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(404), false);
});

test('a read that works is made once', async () => {
  let calls = 0;
  const result = await readWithRetry(async () => (calls++, ok()), noWait);
  assert.equal(result.error, null);
  assert.equal(calls, 1);
});

test('a failed read is retried after a pause, then succeeds', async () => {
  const waits: number[] = [];
  let calls = 0;
  const result = await readWithRetry(async () => (++calls < 3 ? fail(500) : ok()), {
    retryDelaysMs: [1000, 2500],
    sleep: async (ms) => void waits.push(ms),
    random: () => 0.5,
  });
  assert.equal(result.error, null);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 2500]);
});

test('retries are jittered within a quarter either way', async () => {
  const waits: number[] = [];
  const run = (random: number) =>
    readWithRetry(async () => fail(500), {
      retryDelaysMs: [1000],
      sleep: async (ms) => void waits.push(ms),
      random: () => random,
    });
  await run(0);
  await run(1);
  assert.deepEqual(waits, [750, 1250]);
});

test('gives up after the last attempt and returns the error', async () => {
  let calls = 0;
  const result = await readWithRetry(async () => (calls++, fail(503)), {
    ...noWait,
    retryDelaysMs: [1, 1],
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 503);
});

test('a request the server rejected is not retried', async () => {
  let calls = 0;
  const result = await readWithRetry(async () => (calls++, fail(400)), noWait);
  assert.equal(calls, 1);
  assert.equal(result.status, 400);
});
