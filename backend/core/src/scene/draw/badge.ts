import type { Frame } from '../types.ts';
import { outlinedText } from './text.ts';

const MAX_SHOWN = 99;
const frames = new Map<number, Frame>(); // by count, so the same count is the same frame

// "+N": the subagents with no room left.
export function badgeFrame(count: number): Frame {
  const n = Math.min(count, MAX_SHOWN);
  const cached = frames.get(n);
  if (cached) return cached;
  const { w, h, pixels } = outlinedText(`+${n}`);
  const frame: Frame = { w, h, pixels, dx: 0, opacity: 1, solid: [0, w] };
  frames.set(n, frame);
  return frame;
}
