import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toScreen, toUpright, turnedSize, turnPixels, turnRect } from '../../../src/scene/stage/orient.ts';
import type { Side } from '../../../src/scene/types.ts';

const EDGES: Side[] = ['bottom', 'right', 'top', 'left'];
const box = { x: 100, y: 50, width: 80, height: 30 };

test('a point turned to an edge and back is the same point', () => {
  for (const edge of EDGES) {
    for (const p of [
      { x: 100, y: 50 },
      { x: 130, y: 61 },
      { x: 180, y: 80 },
    ]) {
      assert.deepEqual(toUpright(edge, box, toScreen(edge, box, p)), p, edge);
    }
  }
});

test('the feet face the edge: the bottom of the upright box ends up against it', () => {
  const feet = { x: 140, y: 80 }; // middle of the upright box's bottom
  const size = (edge: Side) => turnedSize(edge, box.width, box.height);
  assert.equal(toScreen('right', box, feet).x, box.x + size('right').width, 'against the right side');
  assert.equal(toScreen('top', box, feet).y, box.y, 'against the top');
  assert.equal(toScreen('left', box, feet).x, box.x, 'against the left side');
});

test('turned pixels land where the turned rectangle puts them', () => {
  const w = 3;
  const h = 2;
  const pixels = Uint8Array.from([1, 0, 0, 0, 0, 0]); // the top-left pixel only
  for (const edge of EDGES) {
    const size = turnedSize(edge, w, h);
    const turned = turnPixels(pixels, w, h, edge);
    const at = turned.indexOf(1);
    const cell = { x: at % size.width, y: Math.floor(at / size.width) };
    // Where the top-left art pixel of a sprite at the box's corner goes, in pixel units.
    const unit = { x: 0, y: 0, width: w, height: h };
    const r = turnRect(edge, unit, { x: 0, y: 0, width: 1, height: 1 });
    assert.deepEqual(cell, { x: r.x, y: r.y }, edge);
  }
});
