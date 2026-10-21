import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signLayout } from '../../../src/scene/draw/sign.ts';
import { Stage } from '../../../src/scene/stage/stage.ts';
import type { Screen, SpriteDraw } from '../../../src/scene/types.ts';
import type { Session } from '../../../src/session/types.ts';

const SCREEN: Screen = { id: 7, area: { x: 0, y: 25, width: 1440, height: 875 } };
const PX = 4;
const MIN = 60_000;

const session = (id: string, pid: number): Session => ({
  id,
  pid,
  cwd: `/p/${id}`,
  project: id,
  activity: 'idle',
  mood: 'none',
  agents: [],
  since: 0,
  seenAt: 0,
  startedAt: 0,
});

function setup(settings: object = {}, sessions: Session[] = [session('a', 1), session('b', 2)]) {
  let t = 100_000;
  const stage = new Stage(null, () => t);
  stage.setScreens([SCREEN]);
  const sync = (list: Session[], more: object = {}) =>
    stage.sync({ now: t, sessions: list, settings: { size: PX, ...settings, ...more } });
  sync(sessions);
  const tick = (ms = 16, pointer: { x: number; y: number } | null = null) => {
    t += ms;
    return stage.tick(pointer);
  };
  // At the screen for `minutes`, the app sampling the idle time every 5 s.
  const work = (minutes: number, idleMs = 0) => {
    for (let i = 0; i < (minutes * MIN) / 5000; i++) {
      t += 5000;
      stage.idle(idleMs);
    }
  };
  const sign = (sprites: SpriteDraw[]): SpriteDraw | undefined =>
    sprites.find((sprite) => sprite.w === signLayout(50, 5).w && sprite.h === signLayout(50, 5).h);
  // A point on a button, in screen points.
  const button = (drawn: SpriteDraw, name: 'skip' | 'done') => {
    const b = signLayout(50, 5).buttons[name];
    return { x: drawn.x + (b.x + 2) * drawn.px, y: drawn.y + (b.y + 2) * drawn.px };
  };
  return { stage, tick, work, sign, button, sync };
}

test('after 50 minutes at the screen the first Clawd holds up the sign above its head', () => {
  const { tick, work, sign } = setup();
  work(49);
  assert.equal(sign(tick().sprites), undefined);
  work(1);
  const view = tick();
  const drawn = sign(view.sprites);
  assert.ok(drawn);
  assert.equal(drawn.px, PX / 2);
  const first = view.sprites[0];
  assert.ok(drawn.y + drawn.h * drawn.px <= first.y, 'above the Clawd');
  assert.equal(view.sprites.at(-1), drawn, 'over everything');
});

test('5 minutes away is a break: no sign after it', () => {
  const { tick, work, sign } = setup();
  work(45);
  work(6, 6 * MIN);
  work(10);
  assert.equal(sign(tick().sprites), undefined);
});

test('with nobody on screen the sign waits for the first Clawd', () => {
  const { tick, work, sign, sync } = setup({}, []);
  work(50);
  assert.equal(tick().sprites.length, 0);
  sync([session('a', 1)]);
  assert.ok(sign(tick().sprites));
});

test('the sign takes the mouse and shows no tooltip; skip puts it off for the snooze', () => {
  const { stage, tick, work, sign, button } = setup();
  work(50);
  const drawn = sign(tick().sprites);
  assert.ok(drawn);
  const skip = button(drawn, 'skip');
  assert.equal(stage.hit(skip.x, skip.y), true);
  assert.equal(tick(16, skip).tooltip, undefined);
  assert.equal(stage.press(skip.x, skip.y), false, 'no drag');
  assert.equal(sign(tick().sprites), undefined);
  work(4);
  assert.equal(sign(tick().sprites), undefined);
  work(1);
  assert.ok(sign(tick().sprites));
});

test('done starts a new 50 minutes', () => {
  const { stage, tick, work, sign, button } = setup();
  work(50);
  const drawn = sign(tick().sprites);
  assert.ok(drawn);
  const done = button(drawn, 'done');
  stage.press(done.x, done.y);
  stage.release();
  work(49);
  assert.equal(sign(tick().sprites), undefined);
  work(1);
  assert.ok(sign(tick().sprites));
});

test('turned off, there is no sign; the sliders set the minutes on it', () => {
  const { tick, work, sign, sync } = setup({ breaks: false });
  work(50);
  assert.equal(sign(tick().sprites), undefined);
  sync([session('a', 1)], { breaks: true, breakAfter: 1800, breakSnooze: 600 });
  const wide = signLayout(30, 10);
  assert.ok(tick().sprites.some((sprite) => sprite.w === wide.w && sprite.h === wide.h));
});

test('hovering any Clawd tells the time until the break; turned off, it does not', () => {
  const { stage, tick, work, sync } = setup();
  work(20);
  const view = tick();
  const [, second] = view.sprites;
  const on = { x: second.x + 10 * second.px, y: second.y + 15 * second.px };
  assert.equal(stage.hit(on.x, on.y), true);
  assert.match(tick(16, on).tooltip?.text ?? '', /\nbreak in 30 min$/);
  work(30);
  assert.match(tick(16, on).tooltip?.text ?? '', /\ntime for a break$/);
  sync([session('a', 1), session('b', 2)], { breaks: false });
  assert.doesNotMatch(tick(16, on).tooltip?.text ?? '', /break/);
});
