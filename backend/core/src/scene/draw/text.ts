import { GLYPH_H, GLYPH_W, GLYPHS } from '../art/digits.ts';
import { PAL } from '../constants/look.ts';

export interface Pixels {
  readonly w: number;
  readonly h: number;
  readonly pixels: Uint8Array;
}

// Text in white with a dark outline, readable on any background; a column between glyphs.
export function outlinedText(text: string): Pixels {
  const w = text.length * (GLYPH_W + 1) - 1 + 2;
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
  return { w, h, pixels };
}
