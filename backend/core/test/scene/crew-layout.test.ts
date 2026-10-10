import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MINI_SCALE } from '../../src/scene/constants/crew.ts';
import { GRID_H, GRID_W } from '../../src/scene/constants/grid.ts';
import { AGENT_LEAVE_MS, HANDOVER_MS } from '../../src/scene/constants/timing.ts';
import { assignSlots, crewLayout, deliveryOffset, facesLeft, glide, slotOffset } from '../../src/scene/crew-layout.ts';

test('crew layout keeps minis off the main body and grows only with minis', () => {
  assert.deepEqual(crewLayout([]), {
    width: GRID_W,
    height: GRID_H,
    main: { x: 0, y: 0 },
    minis: [],
    inset: { left: 2, right: 2 },
  });
  assert.equal(crewLayout([0]).inset.left, 2 * MINI_SCALE);
  for (let n = 1; n <= 6; n++) {
    const l = crewLayout([...Array(n).keys()]);
    assert.equal(l.minis.length, n);
    for (const m of l.minis) {
      // Mini body: columns 1..9, rows 6..11 of its half-size grid.
      const left = m.x + 1;
      const right = m.x + 9;
      const topRow = m.y + 6;
      const bottom = m.y + GRID_H * MINI_SCALE;
      const overlaps = right > l.main.x + 2 && left < l.main.x + 18 && bottom > l.main.y + 12 && topRow < l.main.y + 22;
      assert.ok(!overlaps, `slot ${JSON.stringify(m)} of ${n}`);
      assert.ok(m.x >= 0 && m.y >= 0 && m.x + GRID_W * MINI_SCALE <= l.width && m.y + GRID_H * MINI_SCALE <= l.height);
    }
  }
});

test('agents keep their slot while others come and go; minis stay put relative to the main one', () => {
  let slots = assignSlots(new Map(), ['a', 'b', 'c']);
  assert.deepEqual(
    [...slots],
    [
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ],
  );
  slots = assignSlots(slots, ['b', 'c']); // a left
  assert.deepEqual(
    [...slots],
    [
      ['b', 1],
      ['c', 2],
    ],
  );
  slots = assignSlots(slots, ['b', 'c', 'd']); // d takes the free slot 0, b and c don't move
  assert.deepEqual(
    [...slots],
    [
      ['b', 1],
      ['c', 2],
      ['d', 0],
    ],
  );
  assert.equal(assignSlots(new Map(), [...'abcdefgh']).size, 6);
  const l = crewLayout([1, 2]);
  l.minis.forEach((m, i) => {
    assert.deepEqual({ x: m.x - l.main.x, y: m.y - l.main.y }, slotOffset([1, 2][i]));
  });
});

test('glide eases towards the target and settles exactly', () => {
  const half = glide(0, 10, 111);
  assert.ok(half > 4 && half < 6, String(half));
  assert.equal(glide(9.99, 10, 16), 10);
  let x = 0;
  for (let t = 0; t < 2000; t += 16) x = glide(x, 10, 16);
  assert.equal(x, 10);
});

test('a finished subagent walks to the handover point beside the main mascot', () => {
  for (let slot = 0; slot < 6; slot++) {
    const off = slotOffset(slot);
    assert.deepEqual(deliveryOffset(slot, 0), { x: 0, y: 0 });
    const end = deliveryOffset(slot, HANDOVER_MS);
    const at = { x: off.x + end.x, y: off.y + end.y };
    assert.deepEqual(at, facesLeft(slot) ? { x: 18, y: 11 } : { x: -8, y: 11 }, `slot ${slot}`);
    assert.deepEqual(deliveryOffset(slot, AGENT_LEAVE_MS), end);
  }
  // Shoulder slots hop down: up first, then onto the floor.
  assert.ok(deliveryOffset(2, HANDOVER_MS / 4).y < 8 * 0.2);
  // Another mini at the feet: the shoulder one hands over from up there, a far one comes to the shoulder.
  assert.deepEqual(deliveryOffset(2, HANDOVER_MS, [0]), { x: 0, y: 0 });
  assert.deepEqual(deliveryOffset(4, HANDOVER_MS, [0]), { x: 10, y: -8 });
  assert.deepEqual(deliveryOffset(5, HANDOVER_MS, [1, 3]), { x: 0, y: 0 });
});
