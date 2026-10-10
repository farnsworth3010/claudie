import { ART_COLORS, MOUTHS } from '../art/pictures.ts';
import { PAL, SICK_LEVEL } from '../constants/look.ts';
import type { Accessory, Gaze, Point, Pose, Setter, Squash } from '../types.ts';

const { body: BODY, shade: SHADE, ink: INK, white: WHITE, red: RED } = PAL;

// Body rows run 0..7, the legs hang below them from row 8; columns 3..14 are the body, 1..2 and 15..16 the arms.
const LAST_BODY_ROW = 7;
const FIRST_BODY_COL = 3;
const LAST_BODY_COL = 14;
const LEG_COLS = [4, 6, 11, 13] as const;

// Which edges the pose presses in: the top by `squash`, or the side of `wall` when it hit one.
export function squashOf(pose: Pose): Squash {
  const pressed = (side: Pose['wall']): number => (pose.wall === side ? (pose.squash ?? 0) : 0);
  const sideways = pose.wall === 'left' || pose.wall === 'right';
  return { top: sideways ? 0 : (pose.squash ?? 0), left: pressed('left'), right: pressed('right') };
}

export function paintBody(set: Setter, { top, left, right }: Squash): void {
  for (let r = top; r <= LAST_BODY_ROW; r++) {
    for (let c = FIRST_BODY_COL + left; c <= LAST_BODY_COL - right; c++) set(c, r, BODY);
  }
}

// An arm pressed against the wall is hidden behind the flattened side.
export function paintArms(set: Setter, arms: NonNullable<Pose['arms']>, { left, right }: Squash): void {
  const armRows = (up: boolean): number[] => (up ? [2, 3] : [4, 5]);
  if (left === 0) {
    for (const r of armRows(arms === 'up' || arms === 'left')) {
      set(1, r, BODY);
      set(2, r, BODY);
    }
  }
  if (right === 0) {
    for (const r of armRows(arms === 'up' || arms === 'right')) {
      set(15, r, BODY);
      set(16, r, BODY);
    }
  }
}

// A lifted leg is drawn one row short.
export function paintLegs(set: Setter, legs: NonNullable<Pose['legs']>, legLen: number, { left, right }: Squash): void {
  const lifted = legs === 1 ? [4, 11] : legs === 2 ? [6, 13] : legs === 3 ? [4, 6, 11, 13] : [];
  for (const c of LEG_COLS) {
    const at = Math.min(Math.max(c, FIRST_BODY_COL + left), LAST_BODY_COL - right); // legs bunch up under a flattened side
    for (let r = 8; r < LAST_BODY_ROW + legLen; r++) set(at, r, BODY);
    if (!lifted.includes(c)) set(at, LAST_BODY_ROW + legLen, BODY);
  }
}

// Closed eyes don't look anywhere; open ones follow the gaze over the pose's own glances.
export function eyeDirection(pose: Pose, gaze: Gaze | undefined): Point {
  const eyes = pose.eyes ?? 'open';
  if (eyes !== 'closed' && gaze) return gaze;
  return { x: pose.eyeDx ?? 0, y: eyes === 'closed' ? 0 : (pose.eyeDy ?? 0) };
}

export function paintEyes(
  set: Setter,
  eyes: NonNullable<Pose['eyes']>,
  direction: Point,
  { top }: Squash,
  sick: number,
): void {
  for (const c of [5 + direction.x, 12 + direction.x]) {
    if (eyes === 'closed') {
      set(c, 3, SHADE);
      continue;
    }
    const upper = Math.max(2 + direction.y, top + 1);
    // Very ill: heavy lids leave only the lower half of each eye.
    const lidsDrooping = sick >= SICK_LEVEL.veryIll;
    if (!lidsDrooping) set(c, upper, INK);
    set(c, 3 + direction.y, INK);
    if (eyes === 'wide' && top === 0 && !lidsDrooping) set(c, upper - 1, INK);
  }
}

// Bleached bones: the body turns white, with hollow eye sockets, ribs and a spine.
// Its eyes are gone; a red glint in each socket still follows the pointer.
export function paintBones(grid: Uint8Array, set: Setter, gaze: Gaze | undefined): void {
  grid.forEach((color, i) => {
    if (color === BODY || color === SHADE) grid[i] = WHITE;
  });
  for (const c of [5, 6, 11, 12]) for (const r of [2, 3]) set(c, r, INK);
  if (gaze) {
    const r = gaze.y > 0 ? 3 : 2;
    // Sockets are two pixels wide, so looking straight ahead lights both columns of each.
    for (const c of gaze.x < 0 ? [5, 11] : gaze.x > 0 ? [6, 12] : [5, 6, 11, 12]) set(c, r, RED);
  }
  for (const r of [5, 7]) for (let c = 5; c <= 12; c++) set(c, r, INK);
  for (const r of [4, 6]) {
    set(8, r, INK);
    set(9, r, INK);
  }
}

// Pop Cat: the gaping mouth.
export function paintMouth(set: Setter, mouth: NonNullable<Pose['mouth']>): void {
  for (const [r, art] of MOUTHS[mouth]) {
    [...art].forEach((ch, i) => {
      if (ch !== '.') set(4 + i, r, ART_COLORS[ch]);
    });
  }
}

// Hats ride the head down when the body is squashed; face items stay put, glasses move with the eyes.
export function paintAccessory(set: Setter, accessory: Accessory, { top }: Squash, eyes: Point): void {
  for (const [row, art] of accessory) {
    const r = row < 0 ? row + top : row + eyes.y;
    [...art].forEach((ch, i) => {
      const color = ART_COLORS[ch];
      if (color) set(1 + i + (row < 0 ? 0 : eyes.x), r, color);
    });
  }
}

export function paintSymptoms(set: Setter, sick: number, sweat: number, { top }: Squash): void {
  // A sweat drop slides down the temple, then pauses.
  if (sweat >= 0 && sweat < 4) set(15, top + sweat, PAL.ice);
  if (sick >= SICK_LEVEL.feverish) {
    set(4, 4, PAL.cheek);
    set(13, 4, PAL.cheek);
    for (const c of [15, 16, 17]) set(c, 6, WHITE); // thermometer
    set(18, 6, RED);
  }
  if (sick >= SICK_LEVEL.veryIll) {
    for (let c = 5; c <= 12; c++) set(c, top - 1, PAL.ice); // ice pack
    for (let c = 6; c <= 11; c++) set(c, top - 2, PAL.ice);
    set(7, top - 2, WHITE);
  }
}
