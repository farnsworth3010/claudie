import { clamp } from '../shared/math.ts';
import { GLIDE_MS, SLOT_COUNT, SLOT_GAP } from './constants/crew.ts';
import { GRID_H, GRID_W, SOLID } from './constants/grid.ts';
import { HANDOVER_MS } from './constants/timing.ts';
import type { CrewLayout, HandoverSpot, Point } from './types.ts';

// Each agent keeps the slot it got until it leaves, so nobody shuffles when others come and go;
// newcomers take the lowest free slot, and agents beyond the last slot stay off screen.
export function assignSlots(prev: ReadonlyMap<string, number>, ids: readonly string[]): Map<string, number> {
  const next = new Map<string, number>();
  for (const id of ids) {
    const slot = prev.get(id);
    if (slot !== undefined) next.set(id, slot);
  }
  for (const id of ids) {
    if (next.has(id)) continue;
    const used = new Set(next.values());
    const free = Array.from({ length: SLOT_COUNT }, (_, i) => i).find((i) => !used.has(i));
    if (free !== undefined) next.set(id, free);
  }
  return next;
}

// Where a mini `scale` times the main mascot's size stands in `slot`, relative to the main one's
// top-left corner, in main grid pixels: 0 and 1 beside its feet, left and right, 2 and 3 by its
// shoulders, 4 and 5 further out. Bodies keep SLOT_GAP (scaled) clear of each other.
export function slotOffset(slot: number, scale: number): Point {
  const [from, to] = SOLID;
  const feet = GRID_H * (1 - scale); // standing on the main mascot's floor
  const shoulders = feet - (to - from) * scale;
  const besideLeft = from - SLOT_GAP * scale * 2 - to * scale;
  const besideRight = to + SLOT_GAP * scale * 2 - from * scale;
  const step = (to - from + SLOT_GAP) * scale;
  const slots: Point[] = [
    { x: besideLeft, y: feet },
    { x: besideRight, y: feet },
    { x: besideLeft + 1, y: shoulders },
    { x: besideRight - 1, y: shoulders },
    { x: besideLeft - step, y: feet },
    { x: besideRight + step, y: feet },
  ];
  return slots[slot];
}

// Where a finishing mini hands its scroll over: beside the main mascot's feet on its side, or by
// its shoulder when another mini stands at the feet; with both taken it hands over from where it is.
// Listed for the left side, each blocked by the slot standing there.
function handoverSpots(scale: number): HandoverSpot[] {
  const feet = slotOffset(0, scale);
  const shoulder = slotOffset(2, scale);
  return [
    { blockedBy: 0, spot: { x: feet.x + 1, y: feet.y } },
    { blockedBy: 2, spot: { x: shoulder.x, y: shoulder.y } },
  ];
}

// Bounding box of the main mascot plus minis in the given slots; `minis` follow `slots` order.
export function crewLayout(slots: readonly number[], scale: number): CrewLayout {
  const used = slots.map((slot) => slotOffset(slot, scale));
  const minX = Math.min(0, ...used.map((p) => p.x));
  const minY = Math.min(0, ...used.map((p) => p.y));
  const maxX = Math.max(GRID_W, ...used.map((p) => p.x + GRID_W * scale));
  const maxY = Math.max(GRID_H, ...used.map((p) => p.y + GRID_H * scale));
  const main = { x: 0 - minX, y: 0 - minY }; // not -minX: that is -0 for 0
  const minis = used.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const width = maxX - minX;
  const spans = [
    [main.x + SOLID[0], main.x + SOLID[1]],
    ...minis.map((p) => [p.x + SOLID[0] * scale, p.x + SOLID[1] * scale]),
  ];
  return {
    width,
    height: maxY - minY,
    main,
    minis,
    inset: {
      left: Math.min(...spans.map(([left]) => left)),
      right: width - Math.max(...spans.map(([, right]) => right)),
    },
  };
}

// Eases `from` towards `to`, closing ~63% of the gap every `ms`; frontends call it per tick
// so the crew box and the main mascot slide instead of jumping when minis come and go.
export function glide(from: number, to: number, dt: number, ms = GLIDE_MS): number {
  const next = to + (from - to) * Math.exp(-Math.max(dt, 0) / ms);
  return Math.abs(next - to) < 0.02 ? to : next;
}

// Minis to the right of the main one face left, towards it.
export function facesLeft(slot: number): boolean {
  return slot % 2 === 1;
}

// Where a delivering mini in `slot` hands its scroll over: the first spot nobody else blocks,
// mirrored for minis on the right; where it stands when every spot is taken.
// `taken` lists the slots of the other minis still shown.
function handoverSpot(slot: number, taken: readonly number[], scale: number): Point {
  const mirrored = facesLeft(slot);
  const width = GRID_W * scale;
  const reachable = handoverSpots(scale)
    .map(({ blockedBy, spot }) =>
      mirrored ? { blockedBy: blockedBy + 1, spot: { x: GRID_W - width - spot.x, y: spot.y } } : { blockedBy, spot },
    )
    .find(({ blockedBy }) => blockedBy === slot || !taken.includes(blockedBy));
  return reachable?.spot ?? slotOffset(slot, scale);
}

// How far a delivering mini has moved from its slot `elapsed` ms after it finished, in main grid
// pixels: an eased walk to the handover spot, with a hop when it comes down from the shoulders.
export function deliveryOffset(slot: number, elapsed: number, scale: number, taken: readonly number[] = []): Point {
  const from = slotOffset(slot, scale);
  const spot = handoverSpot(slot, taken, scale);
  const t = clamp(elapsed / HANDOVER_MS, [0, 1]);
  const eased = t * t * (3 - 2 * t);
  const hop = spot.y > from.y ? 3 * Math.sin(Math.PI * t) : 0;
  return { x: (spot.x - from.x) * eased + 0, y: (spot.y - from.y) * eased - hop + 0 }; // + 0 turns -0 into 0
}
