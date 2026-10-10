import type { FidgetScene, Step } from '../types.ts';
import { repeat, s } from './steps.ts';

// Waiting for subagents: pastimes of about five seconds each, played in this order by 'fidget'.
export const SCENES = {
  // Rubik's cube, twisted until it's solved.
  cube: [
    ...repeat(14, (i) => s(320, { prop: { cube: i }, eyes: i % 6 === 5 ? 'closed' : 'open' })),
    s(150, { prop: { cube: -1 }, arms: 'up', dy: -1 }),
    s(220, { prop: { cube: -1 }, arms: 'up', dy: -2 }),
    s(150, { prop: { cube: -1 }, arms: 'up', dy: -1 }),
    s(600, { prop: { cube: -1 } }),
  ],
  juggle: repeat(36, (i) =>
    s(140, { prop: { balls: i % 12 }, arms: i % 2 ? 'left' : 'right', eyeDx: i % 12 < 6 ? -1 : 1 }),
  ),
  guitar: repeat(32, (i) => {
    const beat = i % 8;
    return s(180, {
      prop: { guitar: beat },
      arms: beat % 2 ? 'down' : 'right',
      dy: beat % 4 === 2 ? -1 : 0,
      eyes: i >= 16 && beat < 4 ? 'closed' : 'open',
    });
  }),
  // Eyes run along the lines, now and then a page turns.
  book: repeat(16, (i) => {
    const turning = i % 8 === 7;
    return s(turning ? 250 : 400, { prop: { book: turning ? 3 : i % 3 }, eyeDx: turning ? 0 : i % 2 ? 1 : -1 });
  }),
  // Blow, blow, pop, startled blink.
  gum: repeat(2, () => [
    ...repeat(5, (r) => s(r === 4 ? 700 : 350, { prop: { gum: r } })),
    s(200, { prop: { gum: 5 }, eyes: 'wide', dy: -1 }),
    s(400, { eyes: 'wide' }),
    s(300),
  ]),
  // Thrown up from a raised hand and caught.
  yoyo: repeat(24, (i) => s(110, { prop: { yoyo: [0, 2, 4, 6, 8, 8, 6, 4, 2, 0, 0, 0][i % 12] }, arms: 'right' })),
  // Handheld game, then a victory hop.
  game: [
    ...repeat(20, (i) => s(220, { prop: { game: i }, eyeDx: i % 6 < 3 ? -1 : 1 })),
    s(150, { prop: { game: 0 }, arms: 'up', dy: -1 }),
    s(250, { prop: { game: 0 }, arms: 'up', dy: -2 }),
    s(300, { prop: { game: 0 } }),
  ],
  // Legs tucked, floating up and down among sparkles.
  meditate: repeat(20, (i) => s(260, { prop: { sparkle: i }, eyes: 'closed', legs: 3, dy: -[1, 2, 3, 3, 2][i % 5] })),
  // Flicked into a spin on a raised finger, slowing down until the next flick.
  spinner: repeat(2, () => [
    s(150, { prop: { spinner: 0 }, arms: 'right', dy: -1 }),
    ...repeat(18, (i) => s(60, { prop: { spinner: i + 1 }, arms: 'right', eyeDx: 1 })),
    ...[80, 110, 150, 210, 300].map((ms, i) => s(ms, { prop: { spinner: 19 + i }, arms: 'right', eyeDx: 1 })),
  ]),
  // "Six seven": palms up, weighing one against the other.
  sixSeven: repeat(20, (i) =>
    s(260, {
      prop: { digits: i % 2 ? 'right' : 'left' },
      arms: i % 2 ? 'right' : 'left',
      eyeDx: i % 2 ? 1 : -1,
      dy: i % 4 === 1 ? -1 : 0,
    }),
  ),
  // Pop Cat: the mouth snaps wide open and shut, now and then a long hold.
  pop: [
    ...repeat(3, () => [s(380), s(70, { mouth: 1 }), s(260, { mouth: 2, dy: -1 })]),
    s(500),
    s(90, { mouth: 1 }),
    s(1100, { mouth: 2, dy: -1, eyes: 'wide' }),
    s(300),
    ...repeat(4, () => [s(150), s(180, { mouth: 2, dy: -1 })]),
  ],
  tea: [
    ...repeat(8, (i) => s(350, { prop: { cup: 'hold', steam: i % 4 }, arms: 'right' })),
    s(1000, { prop: { cup: 'sip' }, eyes: 'closed', arms: 'right' }),
    ...repeat(6, (i) => s(350, { prop: { cup: 'hold', steam: i % 4 }, arms: 'right' })),
  ],
  // Fast strumming and headbanging, then a leap.
  electric: [
    ...repeat(40, (i) => {
      const beat = i % 8;
      return s(100, {
        prop: { electric: beat },
        arms: i % 2 ? 'down' : 'right',
        squash: beat % 4 === 0 ? 1 : 0,
        dy: beat % 4 === 2 ? -1 : 0,
        eyes: beat % 4 === 0 ? 'closed' : 'open',
      });
    }),
    s(120, { prop: { electric: 1 }, arms: 'up', dy: -1 }),
    s(200, { prop: { electric: 2 }, arms: 'up', dy: -3, legs: 3, eyes: 'wide' }),
    s(120, { prop: { electric: 3 }, arms: 'up', dy: -1 }),
    s(350, { prop: { electric: 4 } }),
  ],
} satisfies Record<FidgetScene, readonly Step[]>;

export const FIDGET_SCENES = Object.keys(SCENES) as FidgetScene[];
