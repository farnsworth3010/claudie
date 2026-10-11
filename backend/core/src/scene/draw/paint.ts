import { ART_COLORS } from '../art/pictures.ts';
import { GRID_H, GRID_W } from '../constants/grid.ts';
import type { ArtRows, Setter } from '../types.ts';

// Paints rows of [row, art] from `col`; `color` overrides the art's own letters.
export function paint(set: Setter, rows: ArtRows, col: number, color?: number): void {
  for (const [r, art] of rows) {
    [...art].forEach((ch, i) => {
      if (ch !== '.') set(col + i, r, color ?? ART_COLORS[ch]);
    });
  }
}

// The same for a plain list of rows from row `row0`.
export function paintFrom(set: Setter, art: readonly string[], col: number, row0: number, color?: number): void {
  art.forEach((row, dr) => {
    [...row].forEach((ch, dc) => {
      if (ch !== '.') set(col + dc, row0 + dr, color ?? ART_COLORS[ch]);
    });
  });
}

// A 2x2 block of pixels with its top-left corner at the given column and row.
export function fillBlock(set: Setter, col: number, row: number, color: number): void {
  for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) set(col + dc, row + dr, color);
}

// Draws art straight onto the grid, in grid coordinates and clipped to it, skipping the body's offsets.
export function stamp(grid: Uint8Array, art: readonly string[], x0: number, y0: number): void {
  art.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = ART_COLORS[ch];
      if (color && x0 + x < GRID_W && y0 + y < GRID_H) grid[(y0 + y) * GRID_W + x0 + x] = color;
    });
  });
}
