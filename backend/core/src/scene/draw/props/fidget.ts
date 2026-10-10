import {
  BALL_COLORS,
  BOLT,
  BOOK,
  CONSOLE,
  CUBE_COLORS,
  CUP,
  DIGITS,
  ELECTRIC,
  GUITAR,
  GUM_POP,
  NOTE,
  SPARKLES,
  SPINNER_COLORS,
} from '../../art/pictures.ts';
import { PAL } from '../../constants/look.ts';
import type { Setter } from '../../types.ts';
import { fillBlock, paint, paintFrom } from '../paint.ts';

const { body: BODY, ink: INK, white: WHITE, red: RED, yellow: YELLOW } = PAL;

// A twist of the cube; -1 is solved.
export function paintCube(set: Setter, twist: number): void {
  for (let c = 6; c <= 10; c++) for (let r = 4; r <= 8; r++) set(c, r, INK);
  for (let k = 0; k < 9; k++) {
    const color = twist < 0 ? YELLOW : CUBE_COLORS[(k * 7 + twist * 3 + (k >> 1) * twist) % CUBE_COLORS.length];
    set(7 + (k % 3), 5 + Math.floor(k / 3), color);
  }
}

// Three balls a third of a lap apart on an oval over the head.
export function paintBalls(set: Setter, phase: number): void {
  BALL_COLORS.forEach((color, i) => {
    const angle = ((phase + i * 4) / 12) * 2 * Math.PI;
    const c = Math.round(8.5 + 6.5 * Math.cos(angle));
    const r = Math.round(-6 - 4 * Math.sin(angle));
    fillBlock(set, c, r, color);
  });
}

// Two notes take turns drifting up from the sound hole.
const NOTE_DRIFTS = [
  [0, 13],
  [4, 10],
] as const;

export function paintGuitar(set: Setter, strum: number): void {
  paint(set, GUITAR, 0);
  for (const [offset, col] of NOTE_DRIFTS) {
    const rise = (strum + offset) % 8;
    if (rise > 5) continue;
    paintFrom(set, NOTE, col + (rise >> 1), -6 - rise, YELLOW);
  }
}

// Sparks fly up off both ends, one after the other.
const SPARK_DRIFTS = [
  [0, 14],
  [3, 0],
  [5, 8],
] as const;

export function paintElectric(set: Setter, phase: number): void {
  paint(set, ELECTRIC, -1);
  for (const [offset, col] of SPARK_DRIFTS) {
    const rise = (phase + offset) % 8;
    if (rise > 5) continue;
    paintFrom(set, BOLT, col + (rise % 2), -4 - rise, YELLOW);
  }
}

// `page` 0..2 is reading, 3 a page turning.
export function paintBook(set: Setter, page: number): void {
  paint(set, BOOK, 3);
  if (page === 3) for (let r = 2; r <= 5; r++) set(9, r, WHITE); // a page standing up mid-turn
}

export function paintGum(set: Setter, size: number): void {
  if (size === 5) {
    for (const [c, r] of GUM_POP) set(c, r, PAL.cheek);
    return;
  }
  for (let r = 5 - size; r <= 5 + size; r++) {
    for (let c = 9 - size; c <= 9 + size; c++) {
      if ((c - 9) ** 2 + (r - 5) ** 2 <= size * size + 1) set(c, r, PAL.cheek);
    }
  }
  if (size >= 2) set(9 - size + 1, 5 - size + 1, WHITE); // shine
}

export function paintYoyo(set: Setter, stringLength: number): void {
  for (let r = 1; r > 1 - stringLength; r--) set(16, r, WHITE);
  fillBlock(set, 16, 1 - stringLength - 2, RED);
}

export function paintGame(set: Setter, step: number): void {
  paint(set, CONSOLE, 5);
  const pos = step % 12;
  set(6 + (pos < 6 ? pos : 11 - pos), 6 + (step % 2), WHITE);
}

export function paintSparkles(set: Setter, phase: number): void {
  SPARKLES.forEach(([c, r], k) => {
    if ((phase + k) % 3 === 0) set(c, r, k % 2 ? YELLOW : WHITE);
  });
}

// Three weighted lobes round a hub, balanced on a finger of the raised right hand.
export function paintSpinner(set: Setter, phase: number): void {
  const [cx, cy] = [15, -3];
  for (let r = cy + 1; r <= 1; r++) set(cx, r, BODY);
  SPINNER_COLORS.forEach((color, k) => {
    const angle = (phase / 9 + k / 3) * 2 * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    set(cx + Math.round(cos), cy + Math.round(sin), INK);
    fillBlock(set, cx + Math.round(2 * cos) - (cos < 0 ? 1 : 0), cy + Math.round(2 * sin) - (sin < 0 ? 1 : 0), color);
  });
  set(cx, cy, INK);
}

// Each digit rides two rows higher while its palm is up.
export function paintDigits(set: Setter, raised: 'left' | 'right'): void {
  for (const [digit, side] of [
    [6, 'left'],
    [7, 'right'],
  ] as const) {
    paintFrom(set, DIGITS[digit], side === 'left' ? 0 : 15, raised === side ? -5 : -3, YELLOW);
  }
}

export function paintCup(set: Setter, cup: 'hold' | 'sip', steam: number | undefined): void {
  const [c0, r0] = cup === 'sip' ? [7, 4] : [13, 3];
  paintFrom(set, CUP, c0, r0);
  if (steam === undefined) return;
  for (let k = 0; k < 3; k++) {
    const r = r0 - 1 - k - (steam % 2);
    if (r > r0 - 5) set(c0 + 1 + ((k + steam) % 2), r, PAL.zed);
  }
}
