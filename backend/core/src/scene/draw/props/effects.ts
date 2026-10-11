import {
  CONFETTI,
  CONFETTI_COLORS,
  LIGHTNING,
  PANIC_DROPS,
  PLUS,
  SCROLL,
  SHINE,
  STORM,
  STORM_BROWS,
} from '../../art/pictures.ts';
import { PAL } from '../../constants/look.ts';
import type { Setter } from '../../types.ts';
import { paint } from '../paint.ts';

const { white: WHITE, ink: INK, blue: BLUE, yellow: YELLOW, green: GREEN } = PAL;

// Stars circling the head.
export function paintDizzy(set: Setter, phase: number): void {
  for (let k = 0; k < 3; k++) {
    const angle = ((phase + k * 2) / 6) * 2 * Math.PI;
    set(Math.round(8.5 + 6 * Math.cos(angle)), Math.round(-2 + 1.5 * Math.sin(angle)), YELLOW);
  }
}

export function paintPanic(set: Setter, phase: number): void {
  PANIC_DROPS.forEach(([c, r], k) => {
    if ((phase + k) % 3 === 0) set(c, r - (phase % 2), PAL.ice);
  });
}

export function paintConfetti(set: Setter, fall: number): void {
  CONFETTI.forEach(([c, r], k) => {
    set(c + ((fall + k) % 3 === 0 ? 1 : 0), r + fall * 2, CONFETTI_COLORS[k % CONFETTI_COLORS.length]);
  });
}

// Slanted brows while stomping, a grey cloud with a flicker of lightning, steam from the head.
export function paintStorm(set: Setter, phase: number): void {
  const stomping = phase < 4;
  if (stomping) for (const [c, r] of STORM_BROWS) set(c, r, INK);
  paint(set, STORM, 4, PAL.zed);
  if (phase % 2) for (const [c, r] of LIGHTNING) set(c, r, YELLOW);
  if (phase % 2 === 0 && stomping) for (const c of [1, 16]) set(c, -1, WHITE);
}

// Tokens squeezed out of the sides.
export function paintBits(set: Setter, spread: number): void {
  for (const [c, r, color] of [
    [2 - spread, 5, YELLOW],
    [1 - spread, 7, WHITE],
    [15 + spread, 5, BLUE],
    [16 + spread, 7, GREEN],
  ] as const) {
    set(c, r, color);
  }
}

export function paintShine(set: Setter, phase: number): void {
  SHINE.forEach(([c, r], k) => {
    if ((phase + k) % 2) return;
    const color = k % 2 ? WHITE : YELLOW;
    if ((phase + k) % 4 === 0) for (const [dc, dr] of PLUS) set(c + dc, r + dr, color);
    else set(c, r, color);
  });
}

export function paintScroll(set: Setter, state: 'held' | 'rolled' | 'open'): void {
  const col = state === 'held' ? 16 : state === 'rolled' ? 5 : 4;
  paint(set, SCROLL[state], col);
}
