import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearest, onTrack, track } from '../../../src/scene/stage/crawl.ts';

const area = { x: 0, y: 25, width: 1000, height: 600 };
const t = track(area, 80, 90, false);

test('the track runs round the screen: floor, right wall, ceiling, left wall, and round again', () => {
  const [floor, wall] = t.lengths;
  assert.deepEqual(onTrack(t, 0), { x: 0, y: 625 - 90, edge: 'bottom' });
  assert.deepEqual(onTrack(t, floor), { x: 1000 - 80, y: 625 - 90, edge: 'bottom' });
  assert.deepEqual(onTrack(t, floor + 1), { x: 1000 - 90, y: 625 - 80 - 1, edge: 'right' });
  assert.equal(onTrack(t, floor + wall + 1).edge, 'top');
  assert.equal(onTrack(t, t.total - 1).edge, 'left');
  assert.deepEqual(onTrack(t, t.total + 5), onTrack(t, 5), 'round again');
});

test('with gravity the track is the floor alone, with ends', () => {
  const floor = track(area, 80, 90, true);
  assert.equal(floor.total, 1000 - 80);
  assert.equal(onTrack(floor, 5000).edge, 'bottom');
  assert.equal(onTrack(floor, 5000).x, 1000 - 80);
});

test('a box finds its nearest edge, and how far off it still is', () => {
  assert.deepEqual(nearest(t, { x: 300, y: 625 - 90 }).gap, 0);
  assert.equal(nearest(t, { x: 300, y: 625 - 90 }).s, 300);
  const nearTop = nearest(t, { x: 300, y: 40 });
  assert.equal(nearTop.gap, 15);
  assert.equal(onTrack(t, nearTop.s).edge, 'top');
  assert.equal(
    onTrack(track(area, 80, 90, true), nearest(track(area, 80, 90, true), { x: 300, y: 40 }).s).edge,
    'bottom',
  );
});
