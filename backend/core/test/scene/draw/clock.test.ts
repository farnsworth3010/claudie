import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOCK_FACE } from '../../../src/scene/constants/clock.ts';
import { PAL } from '../../../src/scene/constants/look.ts';
import { clockFrame } from '../../../src/scene/draw/clock.ts';

const count = (pixels: Uint8Array, colour: number) => pixels.filter((p) => p === colour).length;
const dial = (used: number) =>
  clockFrame('fiveHour', used).pixels.slice(0, CLOCK_FACE * clockFrame('fiveHour', used).w);

test('the dial fills with the share used, green, then yellow, then red', () => {
  assert.equal(count(dial(0), PAL.green), 0);
  const quarter = count(dial(25), PAL.green);
  const half = count(dial(49), PAL.green);
  assert.ok(quarter > 0 && half > quarter);
  assert.equal(count(dial(60), PAL.green), 0);
  assert.ok(count(dial(60), PAL.yellow) > half);
  assert.equal(count(dial(100), PAL.white), 0, 'all of the face is filled');
  assert.ok(count(dial(100), PAL.red) > 0);
});

test('the label sits under the dial, and the same reading is the same frame', () => {
  const frame = clockFrame('sevenDay', 41.2);
  assert.ok(frame.h > CLOCK_FACE + 1);
  const label = frame.pixels.slice((CLOCK_FACE + 1) * frame.w);
  assert.ok(label.includes(PAL.white) && label.includes(PAL.ink));
  assert.equal(clockFrame('sevenDay', 41.4), frame, 'rounded to whole percent');
  assert.notEqual(clockFrame('fiveHour', 41), frame, 'its own label');
});
