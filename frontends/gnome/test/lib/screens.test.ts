import assert from 'node:assert/strict';
import { test } from 'node:test';
import { area, contains, union } from '../../src/lib/screens.ts';

const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
const work = { x: 64, y: 32, width: 1856, height: 1048 }; // a top bar and a dock on the left

test('the work area unless the settings give back the dock or the top bar', () => {
  assert.deepEqual(area(monitor, work, false, false), work);
  assert.deepEqual(area(monitor, work, true, false), { x: 0, y: 32, width: 1920, height: 1048 });
  assert.deepEqual(area(monitor, work, false, true), { x: 64, y: 0, width: 1856, height: 1080 });
  assert.deepEqual(area(monitor, work, true, true), monitor);
});

test('union covers every rect and is null for none', () => {
  assert.equal(union([]), null);
  const rects = [
    { x: 10, y: 20, width: 5, height: 5 },
    { x: 0, y: 30, width: 2, height: 10 },
  ];
  assert.deepEqual(union(rects), { x: 0, y: 20, width: 15, height: 20 });
});

test('contains includes the top-left edge and leaves out the bottom-right one', () => {
  assert.ok(contains(monitor, 0, 0));
  assert.ok(!contains(monitor, 1920, 500));
});
