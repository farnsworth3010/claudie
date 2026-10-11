import { OY } from '../constants/grid.ts';
import { AGENT_LEAVE_MS, HANDOVER_AT, HANDOVER_MS } from '../constants/timing.ts';
import type { Fx, Pose, Side, Step } from '../types.ts';
import { repeat, s } from './steps.ts';

// Dragged into a screen edge: splat flat against it, bounce back off it, then a dizzy wobble.
// The squashed side is pushed out to where the arm reached, so it touches the edge; the ceiling
// is reached by a leap, since the headroom above the body is kept for bubbles.
export function bumpSteps(wall: Side): Step[] {
  const away = wall === 'left' ? 1 : wall === 'right' ? -1 : 0;
  const splat = (squash: number): Pose => ({
    wall,
    squash,
    eyes: 'closed',
    fx: 'stars',
    dx: -away * (2 + squash),
    dy: wall === 'top' ? -OY - squash : 0,
    legs: wall === 'bottom' ? 3 : 0,
  });
  const lift = wall === 'top' ? -OY / 2 : wall === 'bottom' ? -2 : 0;
  return [
    ...(wall === 'top' ? [s(60, { arms: 'up', dy: -OY / 2 })] : []),
    s(70, splat(2)),
    s(90, splat(1)),
    s(120, { wall, eyes: 'wide', fx: 'stars', dx: 2 * away, dy: lift, arms: wall === 'bottom' ? 'up' : 'down' }),
    s(90, { eyes: 'wide', dx: away, dy: Math.round(lift / 2) }),
    ...repeat(6, (i) => s(150, { prop: { dizzy: i }, eyeDx: i % 2 ? 1 : -1, dx: i < 3 ? away : 0 })),
  ];
}

// Magnifier sweep across the face; eyes follow it, and an eye under the glass looks huge.
const LENS_PATH = [1, 2, 4, 6, 8, 10, 12, 11, 9, 7, 5, 3];
const lensStep = (x0: number): Step => {
  const centre = x0 + 2.5;
  const eyeDx = centre < 7.5 ? -1 : centre > 9.5 ? 1 : 0;
  const big = [5, 12].some((c) => c + eyeDx >= x0 + 1 && c + eyeDx <= x0 + 4);
  return s(160, { prop: { lens: x0, big }, eyeDx });
};
export const LENS_SWEEP: Step[] = LENS_PATH.map(lensStep);

export const STRIDE: Step[] = [s(150, { legs: 1 }), s(150, { legs: 2, dy: -1 })];

// Facing right: walk to the main mascot, hold the scroll out, let go, wave goodbye.
export const DELIVER: Step[] = [
  ...repeat(4, (i) => s(HANDOVER_MS / 4, i % 2 ? { legs: 2, dy: -1 } : { legs: 1 })),
  s(HANDOVER_AT - HANDOVER_MS, { arms: 'right', prop: { scroll: 'held' }, eyes: 'wide' }),
  s(300, { eyes: 'closed' }),
  s(200),
  ...repeat(4, (i) => s((AGENT_LEAVE_MS - HANDOVER_AT - 500) / 4, i % 2 ? {} : { arms: 'right', eyes: 'closed' })),
];

// Facing right: two idle Clawds side by side chat, the left one opening (A), the right one replying (B).
const speak = (ms: number): Step[] => repeat(3, (i) => s(ms / 3, { fx: `chat${i + 1}` as Fx, dy: i === 0 ? -1 : 0 }));
const listen = (ms: number): Step => s(ms, { eyeDx: 1 });
const WAVE = repeat(6, (i) => s(220, i % 2 ? { eyeDx: 1 } : { arms: 'right', eyes: 'closed' }));

export const CHAT_A: Step[] = [...speak(1100), listen(1100), ...speak(900), ...WAVE];
export const CHAT_B: Step[] = [listen(1100), ...speak(1100), listen(900), ...WAVE];
