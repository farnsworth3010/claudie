import { AIR_FRICTION_MS, BOUNCE, GRAVITY, GROUND_FRICTION_MS, REST_SPEED } from '../constants/stage.ts';
import { confine } from '../geometry.ts';
import type { Inset, Rect, Side } from '../types.ts';

// Something thrown or falling: where its top-left corner is and how fast it goes, in points per ms.
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Physics {
  readonly inertia: boolean;
  readonly gravity: boolean;
}

// One step of flight for a w×h body: gravity pulls, friction slows, the area's edges bounce it back.
// Returns the edges hit, with the speed of each impact, and whether it has come to rest: slow
// enough, and on the floor if gravity is on.
export function fly(
  body: Body,
  w: number,
  h: number,
  area: Rect,
  dt: number,
  { inertia, gravity }: Physics,
  inset?: Inset,
): { hits: { side: Side; speed: number }[]; resting: boolean } {
  const floor = area.y + area.height - h;
  const grounded = gravity && body.y >= floor - 0.5;
  if (gravity && !grounded) body.vy += GRAVITY * dt;
  if (inertia) {
    const k = Math.exp(-dt / (grounded ? GROUND_FRICTION_MS : AIR_FRICTION_MS));
    body.vx *= k;
    if (!gravity) body.vy *= k;
  }
  const to = confine(body.x + body.vx * dt, body.y + body.vy * dt, w, h, area, inset);
  const hits = to.walls.map((side) => bounce(body, side));
  body.x = to.x;
  body.y = to.y;
  const resting = Math.hypot(body.vx, body.vy) < REST_SPEED && (!gravity || body.y >= floor - 0.5);
  return { hits, resting };
}

// Off a wall with some of its speed.
function bounce(body: Body, side: Side): { side: Side; speed: number } {
  const across = side === 'left' || side === 'right' ? 'vx' : 'vy';
  const speed = Math.abs(body[across]);
  const away = side === 'left' || side === 'top' ? 1 : -1;
  const kept = speed * BOUNCE;
  body[across] = kept < REST_SPEED ? 0 : away * kept;
  return { side, speed };
}
