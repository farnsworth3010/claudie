import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeTooltip } from '../../src/lib/tooltip.ts';

const monitor = { x: 0, y: 0, width: 1000, height: 800 };

test('centred above the point, its bottom on it', () => {
  assert.deepEqual(placeTooltip(100, 20, 500, 400, monitor), { x: 450, y: 380, width: 100, height: 20 });
});

test('kept inside the monitor near its edges', () => {
  assert.deepEqual(placeTooltip(100, 20, 10, 10, monitor), { x: 0, y: 0, width: 100, height: 20 });
  assert.deepEqual(placeTooltip(100, 20, 995, 400, monitor), { x: 900, y: 380, width: 100, height: 20 });
});
