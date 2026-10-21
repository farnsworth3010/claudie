import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Limits } from '../../../src/limits/types.ts';
import { Stage } from '../../../src/scene/stage/stage.ts';
import type { Screen } from '../../../src/scene/types.ts';
import type { Session } from '../../../src/session/types.ts';

const SCREEN: Screen = { id: 0, area: { x: 0, y: 0, width: 1440, height: 900 } };
const PX = 4;
const T = 100_000;
const HOUR = 3_600_000;
const LIMITS: Limits = {
  fiveHour: { used: 23, resetsAt: T + 2 * HOUR + 14 * 60_000 },
  sevenDay: { used: 81, resetsAt: T + 76 * HOUR },
};

const session: Session = {
  id: 's',
  pid: 1,
  cwd: '/p/demo',
  project: 'demo',
  activity: 'idle',
  mood: 'none',
  agents: [],
  since: T,
  seenAt: T,
  startedAt: T,
};

function setup(limits: Limits | undefined, on = true, sessions: Session[] = [session], settings: object = {}) {
  let t = T;
  const stage = new Stage(
    null,
    () => t,
    () => 0.5,
  );
  stage.setScreens([SCREEN]);
  stage.sync({ now: t, sessions, settings: { size: PX, limits: on, ...settings }, ...(limits && { limits }) });
  const tick = (ms = 16, pointer: { x: number; y: number } | null = null) => {
    t += ms;
    return stage.tick(pointer);
  };
  return { stage, tick };
}

test('off by default, and nothing without limits or without a session', () => {
  const plain = new Stage(null, () => T);
  plain.setScreens([SCREEN]);
  plain.sync({ now: T, sessions: [session], limits: LIMITS });
  assert.equal(plain.tick(null).sprites.length, 1);
  assert.equal(setup(LIMITS, false).tick().sprites.length, 1);
  assert.equal(setup(undefined).tick().sprites.length, 1);
  assert.equal(setup(LIMITS, true, []).tick().sprites.length, 0);
});

test('the clocks stand in the bottom-right corner, and the group makes way for them, left on the same floor', () => {
  const [clawd, five, week] = setup(LIMITS).tick(2_000).sprites;
  assert.equal(week.x + week.w * week.px, SCREEN.area.width - 24, 'the right margin');
  assert.equal(week.y + week.h * week.px, SCREEN.area.height - 24, 'the bottom margin');
  assert.equal(five.y + five.h * five.px, week.y + week.h * week.px, 'the clocks on one floor');
  assert.equal(clawd.y + clawd.h * clawd.px, SCREEN.area.height - 24, 'the group on the same floor');
  assert.ok(clawd.x + 18 * clawd.px <= five.x, 'the body left of the clocks');
});

test('the clocks are dragged on their own, stay where they are let go, and the anchor keeps them there', () => {
  const { stage, tick } = setup(LIMITS);
  const [, five] = tick(2_000).sprites;
  const grip = { x: five.x + five.w, y: five.y + 5 * five.px };
  assert.equal(stage.press(grip.x, grip.y), true);
  stage.motion(grip.x - 300, grip.y - 200);
  tick();
  stage.release();
  const [clawd, clock] = tick().sprites;
  assert.deepEqual({ x: clock.x, y: clock.y }, { x: five.x - 300, y: five.y - 200 });
  const [alone] = setup(LIMITS, false).tick(2_000).sprites;
  const feet = (s: typeof clawd) => ({ x: s.x, y: s.y + s.h * s.px });
  assert.deepEqual(feet(clawd), feet(alone), 'the group is back in its own corner');
  const anchor = stage.takeActions().find((action) => action.type === 'anchor');
  assert.ok(anchor?.type === 'anchor' && anchor.anchor.clocks, 'the clocks are anchored');

  const again = new Stage(anchor.anchor, () => T + 60_000);
  again.setScreens([SCREEN]);
  again.sync({ now: T + 60_000, sessions: [session], settings: { size: PX, limits: true }, limits: LIMITS });
  const [, back] = again.tick(null).sprites;
  assert.deepEqual({ x: back.x, y: back.y }, { x: clock.x, y: clock.y });
});

test('dragged onto the group, the clocks make way; the group dragged onto them stops short', () => {
  const { stage, tick } = setup(LIMITS);
  const [clawd, five] = tick(2_000).sprites;
  const overlaps = (a: typeof clawd, b: typeof clawd) =>
    a.x < b.x + b.w * b.px && b.x < a.x + a.w * a.px && a.y < b.y + b.h * b.px && b.y < a.y + a.h * a.px;
  const grip = { x: five.x + five.w, y: five.y + 5 * five.px };
  stage.press(grip.x, grip.y);
  stage.motion(clawd.x + 40, grip.y);
  tick();
  stage.release();
  const [group, clock] = tick().sprites;
  assert.ok(!overlaps(group, clock), 'the clocks moved off the group');

  const body = { x: group.x + 10 * PX, y: group.y + 15 * PX };
  stage.press(body.x, body.y);
  for (let i = 1; i <= 20; i++) {
    stage.motion(body.x + i * 20, body.y);
    tick(50);
  }
  stage.release();
  for (let i = 0; i < 40; i++) tick(50);
  const [after, still] = tick().sprites;
  assert.ok(!overlaps(after, still), 'the group stopped at the clocks');
  assert.deepEqual({ x: still.x, y: still.y }, { x: clock.x, y: clock.y }, 'the clocks never moved');
});

test('wandering, the group walks off and the clocks stay put', () => {
  const { tick } = setup(LIMITS, true, [session], { wander: true });
  const [, five] = tick(2_000).sprites;
  for (let i = 0; i < 400; i++) tick(100);
  const [, still] = tick().sprites;
  assert.deepEqual({ x: still.x, y: still.y }, { x: five.x, y: five.y });
});

test('hovering a clock tells the limit, its use and when it resets; the group can be taken by it', () => {
  const { stage, tick } = setup(LIMITS);
  const [, five, week] = tick(2_000).sprites;
  const centre = (s: typeof five) => ({ x: s.x + (s.w * s.px) / 2, y: s.y + 5 * s.px });
  assert.equal(tick(0, centre(five)).tooltip?.text, '5-hour limit\n23% used\nresets in 2 h 14 min');
  assert.equal(tick(0, centre(week)).tooltip?.text, 'Weekly limit\n81% used\nresets in 3 d 4 h');
  assert.equal(stage.hit(centre(five).x, centre(five).y), true);
});

test('a window that has started over is gone until the status line brings the next one', () => {
  const { tick } = setup(LIMITS);
  assert.equal(tick().sprites.length, 3);
  assert.equal(tick(2 * HOUR + 15 * 60_000).sprites.length, 2);
});

test('with clock gravity, clocks let go of in mid-air fall to the bottom; with clock inertia, a throw carries on', () => {
  const drop = setup(LIMITS, true, [session], { clockGravity: true });
  const [, five] = drop.tick(2_000).sprites;
  const grip = { x: five.x + five.w, y: five.y + 5 * five.px };
  drop.stage.press(grip.x, grip.y);
  drop.stage.motion(grip.x - 500, grip.y - 400);
  drop.tick();
  drop.stage.release();
  const [, up] = drop.tick().sprites;
  assert.ok(up.y < five.y - 300, 'let go of up there');
  for (let i = 0; i < 300; i++) drop.tick(16); // the overlay ticks this fast while something flies
  const [, down] = drop.tick().sprites;
  assert.equal(down.y + down.h * down.px, SCREEN.area.y + SCREEN.area.height, 'on the floor');
  assert.equal(drop.tick(1_000).fast, false, 'and at rest');

  const throwing = setup(LIMITS, true, [session], { clockInertia: true });
  const [, start] = throwing.tick(2_000).sprites;
  const hand = { x: start.x + start.w, y: start.y + 5 * start.px };
  throwing.stage.press(hand.x, hand.y);
  for (let i = 1; i <= 5; i++) {
    throwing.stage.motion(hand.x - i * 40, hand.y - i * 30);
    throwing.tick(16);
  }
  throwing.stage.release();
  const [, released] = throwing.tick(0).sprites;
  for (let i = 0; i < 300; i++) throwing.tick(16);
  const [, landed] = throwing.tick().sprites;
  assert.ok(landed.x < released.x - 50, 'it flew on after the release');
});
