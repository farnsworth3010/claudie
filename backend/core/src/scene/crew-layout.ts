import { clamp } from '../shared/math.ts';
import { GLIDE_MS, HANDOVER_SPOTS, MINI_H, MINI_SCALE, MINI_W, SLOTS } from './constants/crew.ts';
import { GRID_H, GRID_W, SOLID } from './constants/grid.ts';
import { HANDOVER_MS } from './constants/timing.ts';
import type { CrewLayout, Point } from './types.ts';

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
    const free = SLOTS.findIndex((_, i) => !used.has(i));
    if (free >= 0) next.set(id, free);
  }
  return next;
}

// Where a mini in `slot` stands relative to the main mascot's top-left corner.
export function slotOffset(slot: number): Point {
  const { x, y } = SLOTS[slot];
  return { x, y };
}

// Bounding box of the main mascot plus minis in the given slots; `minis` follow `slots` order.
export function crewLayout(slots: readonly number[]): CrewLayout {
  const used = slots.map(slotOffset);
  const minX = Math.min(0, ...used.map((p) => p.x));
  const minY = Math.min(0, ...used.map((p) => p.y));
  const maxX = Math.max(GRID_W, ...used.map((p) => p.x + MINI_W));
  const maxY = Math.max(GRID_H, ...used.map((p) => p.y + MINI_H));
  const main = { x: 0 - minX, y: 0 - minY }; // not -minX: that is -0 for 0
  const minis = used.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const width = maxX - minX;
  const spans = [
    [main.x + SOLID[0], main.x + SOLID[1]],
    ...minis.map((p) => [p.x + SOLID[0] * MINI_SCALE, p.x + SOLID[1] * MINI_SCALE]),
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
  return SLOTS[slot].x > 0;
}

// Where a delivering mini in `slot` hands its scroll over: the first spot nobody else blocks,
// mirrored for minis on the right; where it stands when every spot is taken.
// `taken` lists the slots of the other minis still shown.
function handoverSpot(slot: number, taken: readonly number[]): Point {
  const mirrored = facesLeft(slot);
  const reachable = HANDOVER_SPOTS.map(({ blockedBy, spot }) =>
    mirrored ? { blockedBy: blockedBy + 1, spot: { x: GRID_W - MINI_W - spot.x, y: spot.y } } : { blockedBy, spot },
  ).find(({ blockedBy }) => blockedBy === slot || !taken.includes(blockedBy));
  return reachable?.spot ?? slotOffset(slot);
}

// How far a delivering mini has moved from its slot `elapsed` ms after it finished, in main grid
// pixels: an eased walk to the handover spot, with a hop when it comes down from the shoulders.
export function deliveryOffset(slot: number, elapsed: number, taken: readonly number[] = []): Point {
  const from = slotOffset(slot);
  const spot = handoverSpot(slot, taken);
  const t = clamp(elapsed / HANDOVER_MS, [0, 1]);
  const eased = t * t * (3 - 2 * t);
  const hop = spot.y > from.y ? 3 * Math.sin(Math.PI * t) : 0;
  return { x: (spot.x - from.x) * eased + 0, y: (spot.y - from.y) * eased - hop + 0 }; // + 0 turns -0 into 0
}
