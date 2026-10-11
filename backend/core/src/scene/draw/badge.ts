import { GLYPH_H, GLYPH_W, GLYPHS } from '../art/digits.ts';
import { PAL } from '../constants/look.ts';
import type { Frame } from '../types.ts';

const MAX_SHOWN = 99;
const frames = new Map<number, Frame>(); // by count, so the same count is the same frame

// "+N" in white with a dark outline, readable on any background: the subagents with no room left.
export function badgeFrame(count: number): Frame {
  const n = Math.min(count, MAX_SHOWN);
  const cached = frames.get(n);
  if (cached) return cached;
  const text = `+${n}`;
  const w = text.length * (GLYPH_W + 1) - 1 + 2; // a column between glyphs, the outline around
  const h = GLYPH_H + 2;
  const pixels = new Uint8Array(w * h);
  [...text].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, y) => {
      [...row].forEach((dot, x) => {
        if (dot === '#') pixels[(y + 1) * w + 1 + i * (GLYPH_W + 1) + x] = PAL.white;
      });
    });
  });
  // Every empty pixel touching a lit one, diagonals included, becomes the outline.
  const lit = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && pixels[y * w + x] === PAL.white;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[y * w + x]) continue;
      if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => lit(x + dx, y + dy)))) pixels[y * w + x] = PAL.ink;
    }
  }
  const frame: Frame = { w, h, pixels, dx: 0, opacity: 1, solid: [0, w] };
  frames.set(n, frame);
  return frame;
}
