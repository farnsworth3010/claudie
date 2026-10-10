import { SKINS } from '../art/skins.ts';
import { GRID_H, GRID_W, OX, OY } from '../constants/grid.ts';
import type { Appearance, Pose, Setter } from '../types.ts';
import {
  eyeDirection,
  paintAccessory,
  paintArms,
  paintBody,
  paintBones,
  paintEyes,
  paintLegs,
  paintMouth,
  paintSymptoms,
  squashOf,
} from './body.ts';
import { paintBubble, paintFx } from './fx.ts';
import { drawProp } from './props/prop.ts';

// One pose as a GRID_W x GRID_H grid of palette slots, facing right.
export function draw(pose: Pose, appearance: Appearance): Uint8Array {
  const { skin, spin, sick, sweat, gaze, bubble } = appearance;
  const grid = new Uint8Array(GRID_W * GRID_H);
  const legLen = pose.legLen ?? 2;
  const dy = (pose.dy ?? 0) - (legLen - 2);
  const set: Setter = (c, r, color) => {
    const x = OX + c;
    const y = OY + r + dy;
    if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) grid[y * GRID_W + x] = color;
  };

  const squash = squashOf(pose);
  paintBody(set, squash);
  paintArms(set, pose.arms ?? 'down', squash);
  paintLegs(set, pose.legs ?? 0, legLen, squash);

  const eyes = pose.eyes ?? 'open';
  const eyeDir = eyeDirection(pose, gaze);
  if (!pose.skeleton) paintEyes(set, eyes, eyeDir, squash, sick);
  if (pose.skeleton) paintBones(grid, set, eyes !== 'closed' ? gaze : undefined);
  if (pose.mouth) paintMouth(set, pose.mouth);

  if (skin) {
    const { accessory, glasses, spin: turning } = SKINS[skin];
    const worn = turning ? [...accessory, [turning.row, turning.frames[spin]] as const] : accessory;
    paintAccessory(set, worn, squash, glasses ? eyeDir : { x: 0, y: 0 });
  }
  if (sick > 0) paintSymptoms(set, sick, sweat, squash);
  if (pose.prop) drawProp(pose.prop, set);

  paintBubble(grid, pose.fx, bubble);
  paintFx(grid, set, pose, dy);
  return grid;
}
