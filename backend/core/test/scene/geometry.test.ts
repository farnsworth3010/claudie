import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EYES, GAZE_RADIUS, GRID_W } from '../../src/scene/constants/grid.ts';
import { frameAt } from '../../src/scene/frames.ts';
import { confine, gazeAt, opaqueNear } from '../../src/scene/geometry.ts';

test('gaze picks one of eight directions near the face and ignores a far pointer', () => {
  assert.deepEqual(gazeAt(0, 1), { x: 0, y: 0 });
  assert.deepEqual(gazeAt(10, 0), { x: 1, y: 0 });
  assert.deepEqual(gazeAt(-10, -10), { x: -1, y: -1 });
  assert.deepEqual(gazeAt(1, 12), { x: 0, y: 1 });
  assert.equal(gazeAt(GAZE_RADIUS + 1, 0), undefined);
});

test('hit test lands on the body, misses empty headroom', () => {
  const f = frameAt('stand', 0);
  assert.equal(opaqueNear(f, EYES.x, EYES.y), true);
  assert.equal(opaqueNear(f, 2, 2), false);
  assert.equal(opaqueNear(f, GRID_W + 5, 0), false);
});

test('confine keeps the box on the monitor and names the walls it hit', () => {
  const area = { x: 100, y: 0, width: 1000, height: 800 };
  assert.deepEqual(confine(500, 300, 100, 100, area), { x: 500, y: 300, walls: [] });
  assert.deepEqual(confine(50, 750, 100, 100, area), { x: 100, y: 700, walls: ['left', 'bottom'] });
  assert.deepEqual(confine(1050, -5, 100, 100, area), { x: 1000, y: 0, walls: ['right', 'top'] });
  // The box may overhang the side edges by its transparent padding.
  assert.deepEqual(confine(-30, 0, 100, 100, { x: 0, y: 0, width: 500, height: 500 }, { left: 8, right: 8 }), {
    x: -8,
    y: 0,
    walls: ['left'],
  });
});
