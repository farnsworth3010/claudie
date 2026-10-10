import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HUES, SIZES } from '../../src/scene/constants/look.ts';
import { lookPalette, lookScale, pickLook } from '../../src/scene/look.ts';

test('first project is Claude orange, same project shares hue with a new size', () => {
  const a1 = { cwd: '/p/a', look: pickLook([], '/p/a') };
  assert.deepEqual(a1.look, { hue: 0, size: 0 });
  assert.equal(lookPalette(a1.look)[1], '#d97757');
  const a2 = pickLook([a1], '/p/a');
  assert.deepEqual(a2, { hue: 0, size: 1 });
  const b = pickLook([a1, { cwd: '/p/a', look: a2 }], '/p/b');
  assert.deepEqual(b, { hue: 1, size: 0 });
});

test('a freed hue or size is taken again; with all taken the looks wrap round', () => {
  const taken = HUES.map((_, hue) => ({ cwd: `/p/${hue}`, look: { hue, size: 0 } }));
  assert.deepEqual(
    pickLook(
      taken.filter((t) => t.look.hue !== 2),
      '/p/new',
    ),
    { hue: 2, size: 0 },
  );
  assert.deepEqual(pickLook(taken, '/p/new'), { hue: 0, size: 0 });
  const sizes = SIZES.map((_, size) => ({ cwd: '/p/a', look: { hue: 0, size } }));
  assert.deepEqual(pickLook(sizes, '/p/a'), { hue: 0, size: 0 });
});

test('look scale follows the size slot and wraps', () => {
  assert.equal(lookScale({ hue: 0, size: 0 }), 1);
  assert.equal(lookScale({ hue: 0, size: 1 }), 0.8);
  assert.equal(lookScale({ hue: 0, size: SIZES.length }), 1);
});
