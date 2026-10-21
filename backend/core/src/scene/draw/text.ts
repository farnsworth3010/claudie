import { GLYPH_H, GLYPH_W, GLYPHS } from '../art/digits.ts';
import { LETTER_W, LETTERS } from '../art/letters.ts';
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

// The 5×7 letters in one colour into `target`, top-left at `x`, `y`; a column between them.
export function printText(target: Pixels, x: number, y: number, text: string, colour: number): void {
  [...text].forEach((ch, i) => {
    LETTERS[ch].forEach((row, dy) => {
      [...row].forEach((dot, dx) => {
        if (dot === '#') target.pixels[(y + dy) * target.w + x + i * (LETTER_W + 1) + dx] = colour;
      });
    });
  });
}

export function textWidth(text: string): number {
  return text.length * (LETTER_W + 1) - 1;
}
