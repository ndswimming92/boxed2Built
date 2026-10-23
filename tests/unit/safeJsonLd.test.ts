import test from 'node:test';
import assert from 'node:assert/strict';

import { safeJsonLd } from '../../src/utils/safeJsonLd.ts';

test('safeJsonLd cannot be closed early by a </script> in a value', () => {
  const out = safeJsonLd({ reviewBody: '</script><script>alert(1)</script>' });
  assert.ok(!out.includes('<'));
});

test('safeJsonLd output parses back to the original data', () => {
  const data = { a: '</script>     "q"', n: [1, 2] };
  assert.deepEqual(JSON.parse(safeJsonLd(data, 2)), data);
});
