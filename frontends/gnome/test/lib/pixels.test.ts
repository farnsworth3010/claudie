import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rgba } from '../../src/lib/pixels.ts';

test('slots become opaque colours and anything else stays transparent', () => {
  const out = rgba([0, 1, 2, 7], 'transparent,#ff8000,#00FF0a');
  assert.deepEqual([...out], [0, 0, 0, 0, 255, 128, 0, 255, 0, 255, 10, 255, 0, 0, 0, 0]);
});
