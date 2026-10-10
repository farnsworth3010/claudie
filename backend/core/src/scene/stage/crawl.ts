import type { Point, Rect, Side } from '../types.ts';

// The way round the screen a crew box crawls, as one number: how far along it is. It runs right
// along the floor, up the right wall, left along the ceiling, down the left wall and round again;
// with gravity only along the floor. `w`×`h` is the upright box.
export interface Track {
  readonly area: Rect;
  readonly w: number;
  readonly h: number;
  readonly floorOnly: boolean;
  readonly lengths: readonly [number, number, number, number]; // floor, right wall, ceiling, left wall
  readonly total: number;
}

const EDGES: readonly Side[] = ['bottom', 'right', 'top', 'left'];

// A crew longer than the screen is high doesn't fit on a wall, so it keeps to the floor as well.
export function track(area: Rect, w: number, h: number, floorOnly: boolean): Track {
  floorOnly ||= w > area.height;
  const along = Math.max(0, area.width - w);
  const up = Math.max(0, area.height - w);
  const lengths = floorOnly ? ([along, 0, 0, 0] as const) : ([along, up, along, up] as const);
  return { area, w, h, floorOnly, lengths, total: lengths.reduce((sum, length) => sum + length, 0) };
}

// A place on the track kept as a side (0 the floor, 1 the right wall, 2 the ceiling, 3 the left
// wall) and how far along it, so it stays put when the box changes size and the sides with it.
export interface Spot {
  readonly side: number;
  readonly along: number;
}

export function spotAt(t: Track, s: number): Spot {
  let along = t.floorOnly ? Math.min(Math.max(s, 0), t.total) : wrap(s, t.total);
  let side = 0;
  while (side < 3 && along > t.lengths[side]) along -= t.lengths[side++];
  return { side, along };
}

// `by` points further along (back when negative), round the corners; the floor alone has ends.
export function moveAlong(t: Track, spot: Spot, by: number): Spot {
  if (t.floorOnly) return { side: 0, along: Math.min(Math.max(spot.along + by, 0), t.lengths[0]) };
  if (t.total <= 0) return spot;
  let { side, along } = spot;
  along = Math.min(along, t.lengths[side]) + by;
  while (along > t.lengths[side]) {
    along -= t.lengths[side];
    side = (side + 1) % EDGES.length;
  }
  while (along < 0) {
    side = (side + EDGES.length - 1) % EDGES.length;
    along += t.lengths[side];
  }
  return { side, along };
}

// Where the turned box's top-left corner is at a spot, and the edge its feet are on.
export function placeAt(t: Track, spot: Spot): Point & { edge: Side } {
  const { area, w, h } = t;
  const side = t.floorOnly ? 0 : spot.side;
  const rest = Math.min(Math.max(spot.along, 0), t.lengths[side]);
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  const edge = EDGES[side];
  if (edge === 'right') return { x: right - h, y: bottom - w - rest, edge };
  if (edge === 'top') return { x: right - w - rest, y: area.y, edge };
  if (edge === 'left') return { x: area.x, y: area.y + rest, edge };
  return { x: area.x + rest, y: bottom - h, edge };
}

export function onTrack(t: Track, s: number): Point & { edge: Side } {
  return placeAt(t, spotAt(t, s));
}

// The upright box at `box` against its nearest edge, of `sides` when given: where on the track that
// is, and how far off it the box still floats (0 when it touches).
export function nearest(t: Track, box: Point, sides?: readonly Side[]): { s: number; gap: number; to: Point } {
  const { area, w, h, lengths } = t;
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  let gaps: Array<[Side, number]> = [['bottom', bottom - (box.y + h)]];
  if (!t.floorOnly) gaps.push(['right', right - (box.x + w)], ['top', box.y - area.y], ['left', box.x - area.x]);
  if (sides) gaps = gaps.filter(([side]) => sides.includes(side));
  const [edge, gap] = gaps.reduce((best, next) => (next[1] < best[1] ? next : best), gaps[0] ?? ['bottom', 0]);
  const clamp = (v: number, length: number) => Math.min(Math.max(v, 0), length);
  // On a wall the box turns about its middle: w tall, centred where the upright one was.
  const turnedY = box.y + h / 2 - w / 2;
  if (edge === 'right')
    return { s: lengths[0] + clamp(bottom - w - turnedY, lengths[1]), gap, to: { x: right - w, y: box.y } };
  if (edge === 'top')
    return { s: lengths[0] + lengths[1] + clamp(right - w - box.x, lengths[2]), gap, to: { x: box.x, y: area.y } };
  if (edge === 'left')
    return {
      s: lengths[0] + lengths[1] + lengths[2] + clamp(turnedY - area.y, lengths[3]),
      gap,
      to: { x: area.x, y: box.y },
    };
  return { s: clamp(box.x - area.x, lengths[0]), gap, to: { x: box.x, y: bottom - h } };
}

const wrap = (v: number, period: number): number => (period > 0 ? ((v % period) + period) % period : 0);
