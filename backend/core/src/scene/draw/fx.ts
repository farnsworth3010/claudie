import { BUBBLES, CHAT, HEART, IMPACT, PLUS, ZED, ZED_SPOTS } from '../art/pictures.ts';
import { GRID_W, OX, OY } from '../constants/grid.ts';
import { PAL } from '../constants/look.ts';
import type { Bubble, Pose, Setter } from '../types.ts';
import { stamp } from './paint.ts';

const { ink: INK, white: WHITE, yellow: YELLOW } = PAL;

// The pose's own call for attention wins over the one a pending dialog keeps up.
export function paintBubble(grid: Uint8Array, fx: Pose['fx'], pending: Bubble | undefined): void {
  const bubble = fx === 'bang' || fx === 'question' ? fx : pending;
  if (!bubble) return;
  stamp(grid, BUBBLES[bubble], 13, 0);
  grid[9 * GRID_W + 14] = INK; // bubble tail
}

// Marks around the body; `dy` is how far the body has been moved up or down, which wall impacts ignore.
export function paintFx(grid: Uint8Array, set: Setter, pose: Pose, dy: number): void {
  const { fx } = pose;
  if (fx === 'stars' && pose.wall) {
    const color = pose.wall === 'bottom' ? WHITE : YELLOW;
    const shift = pose.dx ?? 0;
    for (const [x, y] of IMPACT[pose.wall]) {
      for (const [dc, dr] of PLUS) set(x - OX - shift + dc, y - OY - dy + dr, color);
    }
  } else if (fx === 'heart1' || fx === 'heart2') {
    stamp(grid, HEART, 13, fx === 'heart1' ? 4 : 1);
  } else if (fx === 'chat1' || fx === 'chat2' || fx === 'chat3') {
    stamp(grid, CHAT(Number(fx[4])), 11, 5);
    grid[10 * GRID_W + 12] = INK; // bubble tail
  } else if (fx === 'z1' || fx === 'z2' || fx === 'z3') {
    for (const [x, y] of ZED_SPOTS.slice(0, Number(fx[1]))) stamp(grid, ZED, x, y);
  }
}
