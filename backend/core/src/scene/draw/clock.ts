import type { LimitKind } from '../../limits/types.ts';
import {
  CLOCK_ALARM,
  CLOCK_FACE,
  CLOCK_LABEL_GAP,
  CLOCK_LABELS,
  CLOCK_RADIUS,
  CLOCK_WARN,
} from '../constants/clock.ts';
import { PAL } from '../constants/look.ts';
import type { Frame } from '../types.ts';
import { outlinedText } from './text.ts';

const frames = new Map<string, Frame>(); // by kind and whole percent

// A dial whose used share fills clockwise from twelve, green, then yellow, then red, over its label.
export function clockFrame(kind: LimitKind, used: number): Frame {
  const percent = Math.round(Math.min(Math.max(used, 0), 100));
  const key = `${kind}:${percent}`;
  const cached = frames.get(key);
  if (cached) return cached;
  const label = outlinedText(CLOCK_LABELS[kind]);
  const w = Math.max(CLOCK_FACE, label.w);
  const h = CLOCK_FACE + CLOCK_LABEL_GAP + label.h;
  const pixels = new Uint8Array(w * h);
  const left = Math.floor((w - CLOCK_FACE) / 2);
  const c = (CLOCK_FACE - 1) / 2;
  const inside = (x: number, y: number) => (x - c) ** 2 + (y - c) ** 2 <= CLOCK_RADIUS ** 2;
  const fill = percent >= CLOCK_ALARM ? PAL.red : percent >= CLOCK_WARN ? PAL.yellow : PAL.green;
  const sweep = (percent / 100) * 2 * Math.PI;
  for (let y = 0; y < CLOCK_FACE; y++) {
    for (let x = 0; x < CLOCK_FACE; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let angle = Math.atan2(x - c, c - y); // from twelve, clockwise on screen
      if (angle < 0) angle += 2 * Math.PI;
      const filled = percent > 0 && angle < sweep;
      pixels[y * w + left + x] = rim ? PAL.ink : filled ? fill : PAL.white;
    }
  }
  pixels[w + left + c] = PAL.ink; // the mark at twelve
  pixels[c * w + left + c] = PAL.ink; // the hands' pin
  const labelLeft = Math.floor((w - label.w) / 2);
  const labelTop = CLOCK_FACE + CLOCK_LABEL_GAP;
  for (let y = 0; y < label.h; y++) {
    for (let x = 0; x < label.w; x++) {
      const dot = label.pixels[y * label.w + x];
      if (dot) pixels[(labelTop + y) * w + labelLeft + x] = dot;
    }
  }
  const frame: Frame = { w, h, pixels, dx: 0, opacity: 1, solid: [0, w] };
  frames.set(key, frame);
  return frame;
}
