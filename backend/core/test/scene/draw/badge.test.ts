import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAL } from '../../../src/scene/constants/look.ts';
import { badgeFrame } from '../../../src/scene/draw/badge.ts';

test('the badge spells +N in white, outlined, and keeps one frame per count', () => {
  const two = badgeFrame(2);
  assert.equal(two.w, 2 * 4 - 1 + 2);
  assert.equal(two.h, 7);
  assert.ok(two.pixels.includes(PAL.white) && two.pixels.includes(PAL.ink));
  assert.equal(badgeFrame(2), two, 'the same frame again');
  assert.equal(badgeFrame(12).w, 3 * 4 - 1 + 2);
  assert.equal(badgeFrame(250), badgeFrame(99), 'no more than two digits');
});
