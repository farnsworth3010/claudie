import { BUTTERFLY_PATH } from '../art/pictures.ts';
import type { Clip, ClipDef } from '../types.ts';
import { bumpSteps, CHAT_A, CHAT_B, DELIVER, LENS_SWEEP, STRIDE } from './builders.ts';
import { SCENES } from './fidgets.ts';
import { durationOf, repeat, s } from './steps.ts';

export const CLIPS = {
  stand: {
    loop: true,
    steps: [
      s(2600),
      s(140, { eyes: 'closed' }),
      s(2200),
      s(120, { eyes: 'closed' }),
      s(90),
      s(120, { eyes: 'closed' }),
    ],
  },
  celebrate: {
    loop: false,
    steps: [
      s(120, { arms: 'up' }),
      s(90, { arms: 'up', dy: -1 }),
      s(200, { arms: 'up', dy: -2 }),
      s(90, { arms: 'up', dy: -1 }),
      s(140, { arms: 'up' }),
      s(90, { arms: 'up', dy: -1 }),
      s(200, { arms: 'up', dy: -2 }),
      s(90, { arms: 'up', dy: -1 }),
      s(600),
    ],
  },
  sad: {
    loop: false,
    steps: [s(300, { squash: 2 }), s(140, { squash: 2, eyes: 'closed' }), s(1800, { squash: 2 })],
  },
  // The user pressed Esc: a flinch, a jolt with wide eyes, a stare, a blink, settling back.
  startled: {
    loop: false,
    steps: [
      s(90, { squash: 1, eyes: 'closed' }),
      s(80, { arms: 'up', dy: -1, eyes: 'wide' }),
      s(110, { arms: 'up', dy: -3, eyes: 'wide' }),
      s(80, { arms: 'up', dy: -1, eyes: 'wide' }),
      s(600, { eyes: 'wide' }),
      s(140, { eyes: 'closed' }),
      s(300),
      s(200, { squash: 1 }),
      s(150),
    ],
  },
  // The user denied a permission: a shake of the head with a red cross, a small slump, standing again.
  refused: {
    loop: false,
    steps: [
      ...repeat(6, (i) => s(110, { dx: i % 2 ? 1 : -1, eyeDx: i % 2 ? 1 : -1, fx: 'cross' })),
      s(120, { squash: 1, eyes: 'closed', fx: 'cross' }),
      s(200, { squash: 1, eyes: 'closed' }),
      s(500, { squash: 1, eyes: 'closed' }),
      s(300),
    ],
  },
  lookAround: {
    loop: false,
    steps: [
      s(800, { eyeDx: -1 }),
      s(250),
      s(800, { eyeDx: 1 }),
      s(250),
      s(500, { eyeDx: -1 }),
      s(400),
      s(120, { eyes: 'closed' }),
      s(880),
    ],
  },
  yawn: {
    loop: false,
    steps: [
      s(900, { eyes: 'closed', arms: 'up', dy: -1 }),
      s(700, { eyes: 'closed' }),
      s(800, { eyes: 'closed', squash: 2 }),
    ],
  },
  sleep: {
    loop: true,
    steps: [
      s(800, { eyes: 'closed', fx: 'z1' }),
      s(800, { eyes: 'closed', fx: 'z2' }),
      s(800, { eyes: 'closed', squash: 1, fx: 'z3' }),
      s(800, { eyes: 'closed', squash: 1 }),
    ],
  },
  work: {
    loop: true,
    steps: [
      s(120, { legs: 1, arms: 'left' }),
      s(120, { legs: 0, arms: 'right', dy: -1 }),
      s(120, { legs: 2, arms: 'left' }),
      s(120, { legs: 0, arms: 'right', dy: -1 }),
    ],
  },
  alert: {
    loop: true,
    steps: [
      s(140, { eyes: 'wide', arms: 'up', fx: 'bang' }),
      s(90, { eyes: 'wide', arms: 'up', dy: -1, fx: 'bang' }),
      s(170, { eyes: 'wide', arms: 'up', dy: -2, fx: 'bang' }),
      s(90, { eyes: 'wide', arms: 'up', dy: -1, fx: 'bang' }),
      s(520, { eyes: 'wide', fx: 'bang' }),
    ],
  },
  ask: {
    loop: true,
    steps: [
      s(700, { eyeDx: -1, fx: 'question' }),
      s(700, { eyeDx: 1, fx: 'question' }),
      s(150, { arms: 'left', dy: -1, fx: 'question' }),
      s(450, { fx: 'question' }),
    ],
  },
  fidget: { loop: true, steps: Object.values(SCENES).flat() },
  // Antics while a dialog has waited too long (and the skeleton for a long-idle session).
  highJump: {
    loop: true,
    steps: [
      s(220, { squash: 2 }),
      s(70, { dy: -3, arms: 'up' }),
      s(70, { dy: -6, arms: 'up', legs: 3 }),
      s(90, { dy: -9, arms: 'up', legs: 3 }),
      s(180, { dy: -10, arms: 'up', legs: 3, eyes: 'wide' }),
      s(90, { dy: -9, legs: 3 }),
      s(70, { dy: -6 }),
      s(70, { dy: -3 }),
      s(150, { squash: 2 }),
      s(350),
    ],
  },
  panic: {
    loop: true,
    steps: repeat(8, (i) =>
      s(90, { arms: i % 2 ? 'left' : 'right', legs: i % 2 ? 1 : 2, dy: -(i % 2), eyes: 'wide', prop: { panic: i } }),
    ),
  },
  // The legs grow five times longer, wobble about, then shrink back.
  longLegs: {
    loop: true,
    steps: [
      ...[2, 4, 6, 8, 10].map((legLen) => s(140, { legLen, eyes: 'wide' })),
      ...repeat(12, (i) =>
        s(200, {
          legLen: 10,
          legs: i % 2 ? 1 : 2,
          arms: i % 4 < 2 ? 'left' : 'right',
          eyeDx: i % 4 < 2 ? -1 : 1,
        }),
      ),
      ...[8, 6, 4].map((legLen) => s(120, { legLen })),
      s(500),
    ],
  },
  // Aged with waiting: beard, a look at the clock, a sigh, a tap of the cane.
  elder: {
    loop: true,
    steps: [
      s(1300, { squash: 1, arms: 'left', eyeDx: -1, prop: { elder: 'watch' } }),
      s(700, { squash: 1, eyes: 'closed', prop: { elder: 'cane' } }),
      ...repeat(4, (i) => s(250, { squash: 1, legs: i % 2 ? 1 : 0, prop: { elder: 'cane' } })),
      s(1000, { squash: 1, arms: 'left', eyeDx: -1, prop: { elder: 'watch' } }),
      s(1000, { squash: 2, eyes: 'closed', prop: { elder: 'cane' } }),
    ],
  },
  // Bones for good; a tumbleweed rolls by now and then.
  skeleton: {
    loop: true,
    steps: [
      ...repeat(27, (i) => s(220, { skeleton: true, prop: { tumbleweed: 19 - i } })),
      s(4000, { skeleton: true }),
    ],
  },
  // Neglected: cobwebbed with a spider letting itself down, then overgrown, then snowed in.
  cobweb: {
    loop: true,
    steps: [
      ...repeat(8, (i) => s(260, { prop: { spider: i }, eyeDx: 1, eyeDy: i > 3 ? 0 : -1 })),
      s(1200, { prop: { spider: 7 }, eyeDx: 1 }),
      s(150, { prop: { spider: 7 }, eyes: 'closed' }),
      s(600, { prop: { spider: 7 }, eyeDx: 1 }),
      ...repeat(8, (i) => s(180, { prop: { spider: 7 - i }, eyeDx: 1, eyeDy: -1 })),
      s(1500, { prop: { spider: 0 } }),
    ],
  },
  sprout: { loop: false, steps: repeat(6, (grow) => s(550, { prop: { garden: 0, grow }, eyeDy: -1 })) },
  overgrown: {
    loop: true,
    steps: repeat(16, (i) =>
      s(260, {
        prop: { garden: i, grow: 5 },
        eyeDx: BUTTERFLY_PATH[i % 8][0] < 9 ? -1 : 1,
        eyeDy: -1,
        eyes: i % 8 === 7 ? 'closed' : 'open',
      }),
    ),
  },
  snowedIn: {
    loop: true,
    steps: repeat(24, (i) =>
      s(200, {
        prop: { snow: i },
        eyes: i % 12 < 2 ? 'closed' : 'open',
        dx: i % 12 === 6 || i % 12 === 8 ? 1 : 0,
      }),
    ),
  },
  bumpLeft: { loop: false, steps: bumpSteps('left') },
  bumpRight: { loop: false, steps: bumpSteps('right') },
  bumpTop: { loop: false, steps: bumpSteps('top') },
  bumpBottom: { loop: false, steps: bumpSteps('bottom') },
  // Clicked: a flinch, a hop with a heart, then a pleased squint.
  poke: {
    loop: false,
    steps: [
      s(90, { squash: 1, eyes: 'closed' }),
      s(80, { arms: 'up', dy: -1, eyes: 'wide' }),
      s(200, { arms: 'up', dy: -3, eyes: 'wide', fx: 'heart1' }),
      s(80, { arms: 'up', dy: -1, fx: 'heart1' }),
      s(750, { eyes: 'closed', fx: 'heart2' }),
    ],
  },
  enter: { loop: true, steps: STRIDE },
  leave: { loop: true, steps: STRIDE },
  walk: { loop: true, steps: STRIDE }, // following a dragging pointer
  // Tools in hand while working.
  type: {
    loop: true,
    steps: repeat(14, (i) =>
      s(110, { prop: { keys: (i * 5) % 14 }, eyeDy: 1, eyeDx: i >= 11 ? 1 : 0, dy: i % 7 === 3 ? -1 : 0 }),
    ),
  },
  hammer: {
    loop: true,
    steps: [
      s(300, { prop: { hammer: 'up' }, arms: 'right', eyeDx: 1, eyeDy: -1 }),
      s(170, { prop: { hammer: 'hit' }, squash: 1, eyes: 'closed' }),
      s(200, { prop: { hammer: 'rest' }, eyeDx: 1, eyeDy: 1 }),
    ],
  },
  search: { loop: true, steps: LENS_SWEEP },
  globe: {
    loop: true,
    steps: repeat(16, (i) => s(170, { prop: { globe: i }, eyeDy: -1, eyeDx: i % 8 < 4 ? -1 : 1 })),
  },
  // Result reactions: a commit or push went through, a test run failed, a compaction finished.
  confetti: {
    loop: false,
    steps: [
      s(80, { arms: 'up', dy: -1, prop: { confetti: 0 } }),
      s(180, { arms: 'up', dy: -3, eyes: 'wide', prop: { confetti: 1 } }),
      s(80, { arms: 'up', dy: -1, prop: { confetti: 2 } }),
      ...repeat(6, (i) => s(170, { arms: i % 2 ? 'up' : 'down', eyes: 'closed', prop: { confetti: 3 + i } })),
    ],
  },
  upset: {
    loop: false,
    steps: [
      ...repeat(4, (i) => s(150, { legs: i % 2 ? 2 : 1, dy: i % 2 ? 0 : -1, prop: { storm: i } })),
      s(1000, { squash: 2, eyes: 'closed', prop: { storm: 4 } }),
    ],
  },
  refresh: {
    loop: false,
    steps: [
      s(120, { arms: 'up', eyes: 'closed', dy: -1 }),
      s(220, { arms: 'up', eyes: 'wide', dy: -2, prop: { shine: 0 } }),
      s(220, { arms: 'up', dy: -1, prop: { shine: 1 } }),
      ...repeat(4, (i) => s(220, { prop: { shine: 2 + i } })),
    ],
  },
  // Compaction: squeezing itself flatter in pulses while tokens squirt out of the sides.
  compact: {
    loop: true,
    steps: [1, 2, 3, 2].map((squash, i) =>
      s(squash === 3 ? 260 : 170, { squash, arms: 'up', eyes: 'closed', prop: { bits: i } }),
    ),
  },
  deliver: { loop: false, steps: DELIVER },
  // The main mascot takes a finished subagent's scroll and skims it.
  receive: {
    loop: false,
    steps: [
      s(200, { prop: { scroll: 'rolled' }, eyes: 'wide' }),
      s(250, { prop: { scroll: 'open' } }),
      s(450, { prop: { scroll: 'open' }, eyeDx: -1 }),
      s(450, { prop: { scroll: 'open' }, eyeDx: 1 }),
      s(200, { prop: { scroll: 'open' }, squash: 1, eyes: 'closed' }),
      s(250, { prop: { scroll: 'open' } }),
    ],
  },
  chatA: { loop: false, steps: CHAT_A },
  chatB: { loop: false, steps: CHAT_B },
} satisfies Record<Clip, ClipDef>;

export const CLIP_NAMES = Object.keys(CLIPS) as Clip[];

export function clipDuration(clip: Clip): number {
  return durationOf(CLIPS[clip].steps);
}
