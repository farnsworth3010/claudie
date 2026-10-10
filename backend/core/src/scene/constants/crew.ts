import type { HandoverSpot, Point } from '../types.ts';
import { GRID_H, GRID_W } from './grid.ts';

export const MINI_SCALE = 0.5;
export const MINI_W = GRID_W * MINI_SCALE;
export const MINI_H = GRID_H * MINI_SCALE;

// Top-left corners of mini Clawds relative to the main one's grid, in main grid pixels:
// beside its feet, by its shoulders, then further out. The main body spans columns 2..17
// and rows 12..21; minis keep clear of it.
export const SLOTS: readonly Point[] = [
  { x: -9, y: 11 },
  { x: 19, y: 11 },
  { x: -8, y: 3 },
  { x: 18, y: 3 },
  { x: -18, y: 11 },
  { x: 28, y: 11 },
];

// Where a finishing mini hands its scroll over: beside the main mascot's feet on its side, or by
// its shoulder when another mini stands at the feet; with both taken it hands over from where it is.
// Listed for the left side, each blocked by the slot standing there.
export const HANDOVER_SPOTS: readonly HandoverSpot[] = [
  { blockedBy: 0, spot: { x: -8, y: 11 } },
  { blockedBy: 2, spot: { x: -8, y: 3 } },
];

export const GLIDE_MS = 160;
// A dragged crew trails the pointer a little, so it follows rather than sticks to it.
export const FOLLOW_MS = 110;
