import { HAMMER, LENS, WORLD } from '../../art/pictures.ts';
import { PAL } from '../../constants/look.ts';
import type { HammerPhase, Setter } from '../../types.ts';
import { paint } from '../paint.ts';

const { ink: INK, white: WHITE, blue: BLUE, yellow: YELLOW, green: GREEN } = PAL;

// A keyboard in front of the legs: two staggered rows of keys in an ink case, two of them
// pressed. Kept below the body so it doesn't read as a grin.
export function paintKeys(set: Setter, pressed: number): void {
  for (let c = 1; c <= 16; c++) {
    set(c, 7, INK);
    set(c, 9, INK);
    set(c, 8, INK);
  }
  for (let k = 0; k < 7; k++) {
    const lit = (row: number): boolean => (k * 2 + row) % 14 === pressed || (k * 2 + row + 7) % 14 === pressed;
    set(2 + k * 2, 8, lit(0) ? YELLOW : PAL.zed);
    if (k < 6) set(3 + k * 2, 9, lit(1) ? YELLOW : PAL.zed);
  }
}

export function paintHammer(set: Setter, phase: HammerPhase): void {
  paint(set, HAMMER[phase], 14);
}

// `x0` is the glass's left column; `big` when it is over an eye.
export function paintLens(set: Setter, x0: number, big: boolean): void {
  LENS.forEach((row, r) => {
    [...row].forEach((ch, i) => {
      if (ch === 'o') set(x0 + i, r, INK);
      else if (ch === 'i') set(x0 + i, r, big && (i === 2 || i === 3) && r >= 1 && r <= 3 ? INK : PAL.ice);
    });
  });
  for (const d of [0, 1]) set(x0 + 5 + d, 6 + d, PAL.brown);
}

// A disc floating over the head, clear of hats; the map scrolls under it as it spins.
export function paintGlobe(set: Setter, spin: number): void {
  for (let r = -11; r <= -5; r++) {
    for (let c = 5; c <= 12; c++) {
      if (Math.hypot(c - 8.5, r + 8) > 3.7) continue;
      const land = WORLD[r + 11][(c + spin) % WORLD[0].length] === 'g';
      set(c, r, land ? GREEN : BLUE);
    }
  }
  set(6, -9, WHITE); // shine
}
