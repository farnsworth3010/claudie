import { BEARD, BUTTERFLY_PATH, CLOCK, FLAKES, PLUS, SPIDER, TUMBLEWEED } from '../../art/pictures.ts';
import { PAL } from '../../constants/look.ts';
import type { Setter } from '../../types.ts';
import { paint, paintFrom } from '../paint.ts';

const { ink: INK, white: WHITE, yellow: YELLOW, green: GREEN } = PAL;

// Rolls with a little bounce, spinning as it goes.
export function paintTumbleweed(set: Setter, col: number): void {
  const art = TUMBLEWEED[col & 1];
  const row = 5 - (col % 3 === 0 ? 1 : 0);
  paintFrom(set, art, col - 2, row, PAL.brown);
}

export function paintElder(set: Setter, held: 'watch' | 'cane'): void {
  paint(set, BEARD, 4, WHITE);
  for (const c of [4, 5, 6, 11, 12, 13]) set(c, 1, WHITE); // bushy brows
  if (held === 'watch') {
    paintFrom(set, CLOCK, -1, -5);
    return;
  }
  for (let r = 3; r <= 9; r++) set(17, r, PAL.brown);
  set(16, 3, PAL.brown);
}

// A web over the head's left corner: spokes from a corner point and two arcs across them,
// and a spider hanging from the top by `drop` rows of thread.
export function paintSpider(set: Setter, drop: number): void {
  const [ax, ay] = [0, -4];
  const web = (radius: number, deg: number): void =>
    set(
      ax + Math.round(radius * Math.cos((deg * Math.PI) / 180)),
      ay + Math.round(radius * Math.sin((deg * Math.PI) / 180)),
      PAL.zed,
    );
  for (const deg of [0, 45, 90]) for (let radius = 0; radius <= 6; radius++) web(radius, deg);
  for (const deg of [15, 30, 60, 75]) {
    web(2.5, deg);
    web(5, deg);
  }
  const y = -10 + drop;
  for (let r = -12; r < y; r++) set(13, r, PAL.zed);
  paintFrom(set, SPIDER, 12, y, INK);
}

// Moss on the head, grass round the feet, and a flower growing out of the top: `grow` of 5,
// with a butterfly once it is in bloom.
export function paintGarden(set: Setter, phase: number, grow: number): void {
  for (const c of [4, 5, 11, 13]) set(c, 0, GREEN);
  for (const c of [1, 8, 16]) {
    set(c + 1, 8, GREEN);
    set(c, 9, GREEN);
    set(c + 1, 9, GREEN);
  }
  const height = Math.min(grow, 4);
  const sway = grow === 5 && phase % 4 >= 2 ? 1 : 0;
  for (let r = -1; r >= -height; r--) set(9 + (r < -2 ? sway : 0), r, GREEN);
  if (height >= 2) set(8, -2, GREEN);
  if (height >= 3) set(10, -3, GREEN);
  if (grow !== 5) return;
  const [fc, fr] = [9 + sway, -6];
  for (const [dc, dr] of PLUS) set(fc + dc, fr + dr, PAL.cheek);
  set(fc, fr, YELLOW);
  const [bc, br] = BUTTERFLY_PATH[phase % BUTTERFLY_PATH.length];
  const up = phase % 2 ? -1 : 0;
  set(bc, br, INK);
  set(bc - 1, br + up, YELLOW);
  set(bc + 1, br + up, YELLOW);
}

// A cap of snow on the head, a drift burying the legs, flakes still falling, a puff of breath.
export function paintSnow(set: Setter, phase: number): void {
  for (let c = 3; c <= 14; c++) set(c, -1, WHITE);
  for (let c = 5; c <= 12; c++) if (c !== 8) set(c, -2, WHITE);
  for (let c = 0; c <= 17; c++) set(c, 9, WHITE);
  for (let c = 1; c <= 16; c++) if (c < 6 || c > 9) set(c, 8, WHITE);
  for (const c of [2, 3, 14, 15]) set(c, 7, WHITE);
  for (const [c, r0] of FLAKES) set(c, ((r0 + phase) % 22) - 12, WHITE);
  if (phase % 6 < 2) {
    set(15, 3, PAL.zed);
    set(16, 2, PAL.zed);
  }
}
