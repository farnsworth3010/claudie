import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAL } from '../../../src/scene/constants/look.ts';
import { SIGN_COLORS } from '../../../src/scene/constants/sign.ts';
import { signFrame, signLayout } from '../../../src/scene/draw/sign.ts';

const at = (frame: { w: number; pixels: Uint8Array }, x: number, y: number) => frame.pixels[y * frame.w + x];

test('the buttons sit inside the board, side by side, and carry the snooze', () => {
  const layout = signLayout(50, 5);
  const { skip, done } = layout.buttons;
  assert.equal(skip.text, 'SKIP (5 MIN)');
  assert.equal(done.text, 'DONE');
  assert.equal(layout.lines[1].text, '50 MIN AT THE SCREEN');
  assert.ok(skip.x > 0 && done.x > skip.x + skip.w);
  assert.ok(done.x + done.w < layout.w && skip.y + skip.h < layout.h);
  assert.ok(skip.y > layout.lines[1].y + 7);
});

test('the board is white inside an ink border; the hovered button lights up', () => {
  const frame = signFrame(50, 5, null);
  const { skip, done } = signLayout(50, 5).buttons;
  assert.equal(at(frame, 0, 0), 0, 'cut corner');
  assert.equal(at(frame, 1, 0), PAL.ink);
  assert.equal(at(frame, 1, 1), SIGN_COLORS.board);
  assert.equal(at(frame, skip.x + 1, skip.y + 1), SIGN_COLORS.skip);
  assert.equal(at(frame, done.x + 1, done.y + 1), SIGN_COLORS.done);
  const hovered = signFrame(50, 5, 'done');
  assert.equal(at(hovered, done.x + 1, done.y + 1), SIGN_COLORS.hovered);
  assert.equal(at(hovered, skip.x + 1, skip.y + 1), SIGN_COLORS.skip);
});

test('the same minutes and hover are the same frame; other minutes resize the board', () => {
  assert.equal(signFrame(50, 5, 'skip'), signFrame(50, 5, 'skip'));
  assert.ok(signLayout(120, 15).w > signLayout(50, 5).w);
});
