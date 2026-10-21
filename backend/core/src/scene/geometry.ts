import { GAZE_RADIUS } from './constants/grid.ts';
import type { Confined, Fitted, Frame, Gaze, Inset, Point, Rect, Side } from './types.ts';

// The pointer's offset from the eyes (grid pixels) -> one of eight directions, or straight ahead
// when it is right on the face; undefined when it is too far away to notice.
export function gazeAt(dx: number, dy: number): Gaze | undefined {
  const dist = Math.hypot(dx, dy);
  if (dist > GAZE_RADIUS) return undefined;
  if (dist < 2) return { x: 0, y: 0 };
  // sin(22.5°): splits the circle into eight equal sectors.
  const axis = (v: number): -1 | 0 | 1 => (Math.abs(v / dist) > 0.38 ? (Math.sign(v) as -1 | 1) : 0);
  return { x: axis(dx), y: axis(dy) };
}

// Whether a point (grid pixels from the drawn frame's corner, `dx` shift included) lands on the
// mascot rather than empty space, forgiving a pixel of slack so small minis are easy to hit.
export function opaqueNear(frame: Frame, gx: number, gy: number, slack = 1): boolean {
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  for (let y = y0 - slack; y <= y0 + slack; y++) {
    for (let x = x0 - slack; x <= x0 + slack; x++) {
      if (x >= 0 && x < frame.w && y >= 0 && y < frame.h && frame.pixels[y * frame.w + x]) return true;
    }
  }
  return false;
}

function fit(value: number, lo: number, hi: number, lowSide: Side, highSide: Side): Fitted {
  const ceiling = Math.max(lo, hi);
  if (value > ceiling) return { value: ceiling, wall: highSide };
  if (value < lo) return { value: lo, wall: lowSide };
  return { value };
}

// Keeps a w×h box inside `area`, letting it overhang the left and right edges by `inset`,
// and reports which edges it was pushed back from.
export function confine(
  x: number,
  y: number,
  w: number,
  h: number,
  area: Rect,
  inset: Inset = { left: 0, right: 0 },
): Confined {
  const fitX = fit(x, area.x - inset.left, area.x + area.width + inset.right - w, 'left', 'right');
  const fitY = fit(y, area.y, area.y + area.height - h, 'top', 'bottom');
  const walls = [fitX.wall, fitY.wall].filter((wall): wall is Side => wall !== undefined);
  return { x: fitX.value, y: fitY.value, walls };
}

// Where `r` goes to keep `gap` clear of `obstacle`: the shortest way along `axes` that stays inside
// `area`, or the shortest of all when none does; undefined when they are apart already.
export function clear(r: Rect, obstacle: Rect, gap: number, area: Rect, axes: 'x' | 'y' | 'xy'): Point | undefined {
  const o = obstacle;
  const apart =
    r.x >= o.x + o.width + gap ||
    r.x + r.width <= o.x - gap ||
    r.y >= o.y + o.height + gap ||
    r.y + r.height <= o.y - gap;
  if (apart) return undefined;
  const ways: Point[] = [];
  if (axes !== 'y') ways.push({ x: o.x - gap - r.width, y: r.y }, { x: o.x + o.width + gap, y: r.y });
  if (axes !== 'x') ways.push({ x: r.x, y: o.y - gap - r.height }, { x: r.x, y: o.y + o.height + gap });
  const inside = (p: Point) =>
    p.x >= area.x && p.y >= area.y && p.x + r.width <= area.x + area.width && p.y + r.height <= area.y + area.height;
  const distance = (p: Point) => Math.abs(p.x - r.x) + Math.abs(p.y - r.y);
  const fitting = ways.filter(inside);
  return (fitting.length ? fitting : ways).reduce((best, p) => (distance(p) < distance(best) ? p : best));
}
