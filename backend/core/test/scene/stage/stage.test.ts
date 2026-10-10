import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipDuration } from '../../../src/scene/clips/clips.ts';
import { GRID_H } from '../../../src/scene/constants/grid.ts';
import { AGENT_LEAVE_MS } from '../../../src/scene/constants/timing.ts';
import { frameAt } from '../../../src/scene/frames.ts';
import { Stage } from '../../../src/scene/stage/stage.ts';
import type { Screen } from '../../../src/scene/types.ts';
import type { Session } from '../../../src/session/types.ts';

const SCREEN: Screen = { id: 7, area: { x: 0, y: 25, width: 1440, height: 875 } };
const PX = 4;

const session = (over: Partial<Session> = {}): Session => ({
  id: 's',
  pid: 1,
  cwd: '/p/demo',
  project: 'demo',
  activity: 'idle',
  mood: 'none',
  agents: [],
  since: 0,
  seenAt: 0,
  startedAt: 0,
  ...over,
});

function setup(settings: object = {}, over: Partial<Session> = {}) {
  let t = 100_000;
  const stage = new Stage(null, () => t);
  stage.setScreens([SCREEN]);
  const sync = (more: Partial<Session> = {}) =>
    stage.sync({
      now: t,
      sessions: [session({ since: t, seenAt: t, ...over, ...more })],
      settings: { size: PX, ...settings },
    });
  sync();
  const tick = (ms = 16, pointer: { x: number; y: number } | null = null) => {
    t += ms;
    return stage.tick(pointer);
  };
  const main = () => tick(0).sprites.at(-1) as NonNullable<ReturnType<typeof tick>['sprites'][number]>;
  // A point on the body, and one in the empty headroom above it.
  const body = () => ({ x: main().x + 10 * PX, y: main().y + 15 * PX });
  const headroom = () => ({ x: main().x + 10 * PX, y: main().y + 2 * PX });
  const click = (p: { x: number; y: number }) => {
    stage.press(p.x, p.y);
    stage.release();
    tick(100);
  };
  return { stage, tick, main, body, headroom, click, sync, now: () => t };
}

test('the crew sits in the bottom-right corner of the work area, keeping the margin', () => {
  const { tick } = setup();
  const view = tick();
  assert.equal(view.sprites.length, 1);
  const [s] = view.sprites;
  assert.equal(s.px, PX);
  assert.equal(s.y + GRID_H * PX, SCREEN.area.y + SCREEN.area.height - 24);
  assert.ok(s.x + 20 * PX <= SCREEN.area.width - 24 + 2 * PX);
  assert.ok(s.pixels, 'a new frame comes with its pixels');
  assert.equal(tick(0).sprites[0].pixels, undefined, 'the same frame again comes without them');
});

test('only the drawn body takes the mouse; the tooltip shows over it', () => {
  const { stage, tick, body, headroom } = setup({}, { tool: 'Bash', activity: 'working', contextTokens: 420_000 });
  tick();
  assert.equal(stage.hit(body().x, body().y), true);
  assert.equal(stage.hit(headroom().x, headroom().y), false);
  assert.equal(stage.press(headroom().x, headroom().y), false);
  assert.equal(tick(16, body()).tooltip?.text, 'demo\nworking · Bash\ncontext 42%');
  assert.equal(tick(16, headroom()).tooltip, undefined);
});

test('a click pokes, three in a row chirp', () => {
  const { stage, tick, body, click } = setup();
  tick();
  click(body());
  click(body());
  assert.deepEqual(stage.takeActions(), []);
  click(body());
  assert.deepEqual(stage.takeActions(), [{ type: 'chirp' }]);
  tick(1000);
  click(body());
  assert.deepEqual(stage.takeActions(), []);
});

test('a drag glides the crew after the pointer and anchors it where it settles', () => {
  const { stage, tick, main, body } = setup();
  tick();
  const before = main().x;
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x - 300, from.y);
  assert.ok(tick().fast, 'ticks on the display refresh while moving');
  stage.release();
  for (let i = 0; i < 100; i++) tick();
  assert.equal(main().x, before - 300);
  assert.deepEqual(stage.takeActions(), [{ type: 'anchor', anchor: { screen: 7, right: 24 + 300, bottom: 24 } }]);
});

test('held down, the crew keeps walking even with the pointer still; let go, it stops once settled', () => {
  const { stage, tick, body } = setup();
  const pixels = new Map<number, string>();
  const drawn = (view: ReturnType<typeof tick>) => {
    const s = view.sprites.at(-1);
    if (s?.pixels) pixels.set(s.id, s.pixels.join());
    return pixels.get(s?.id ?? -1) ?? '';
  };
  const walk = new Set<string>();
  for (let t = 0; t < clipDuration('walk'); t += 10) walk.add(frameAt('walk', t).pixels.join());
  drawn(tick());
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x - 100, from.y);
  const held = Array.from({ length: 120 }, () => drawn(tick()));
  assert.ok(
    held.every((p) => walk.has(p)),
    'every frame while held is a walking one',
  );
  stage.release();
  const after = Array.from({ length: 60 }, () => drawn(tick()));
  assert.ok(!walk.has(after.at(-1) ?? ''), 'stands again after the release');
});

test('dragged past the edge, the crew stops with its body at the wall', () => {
  const { stage, tick, main, body } = setup();
  tick();
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x + 2000, from.y + 2000);
  stage.release();
  for (let i = 0; i < 100; i++) tick();
  const s = main();
  assert.equal(s.x + 18 * PX, SCREEN.area.width, 'the body, not the transparent padding, touches the edge');
  assert.equal(s.y + GRID_H * PX, SCREEN.area.y + SCREEN.area.height);
});

test('ctrl+scroll resizes in whole steps and tells the daemon', () => {
  const { stage, tick } = setup();
  tick();
  stage.zoom(1);
  assert.deepEqual(stage.takeActions(), [{ type: 'settings', patch: { size: PX + 1 } }]);
  stage.zoom(0.5);
  assert.deepEqual(stage.takeActions(), []);
  stage.zoom(0.5);
  assert.deepEqual(stage.takeActions(), [{ type: 'settings', patch: { size: PX + 2 } }]);
  assert.equal(tick().sprites[0].px, PX + 2);
});

test('settings reach the view and the eyes', () => {
  const near = (stage: ReturnType<typeof setup>) => {
    stage.tick();
    const s = stage.main();
    return stage.tick(16, { x: s.x - 20 * PX, y: s.y + 15 * PX }).sprites[0].id;
  };
  const blind = setup({ gaze: false, opacity: 0.5, overFullscreen: true });
  const view = blind.tick();
  assert.equal(view.opacity, 0.5);
  assert.equal(view.overFullscreen, true);
  assert.notEqual(near(setup()), near(blind), 'eyes follow the pointer only when allowed');
});

test('a subagent gets a mini beside the main mascot, which stays to deliver after it finished', () => {
  const { tick, sync, now } = setup();
  tick();
  sync({ activity: 'delegating', agents: [{ id: 'a1', type: 'Explore', startedAt: now(), seenAt: now() }] });
  assert.equal(tick().sprites.length, 2);
  tick(2000);
  sync({ activity: 'idle', agents: [] });
  assert.equal(tick().sprites.length, 2, 'still there, walking its result over');
  assert.equal(tick(AGENT_LEAVE_MS).sprites.length, 1);
});

test('/clear keeps the mascot: the same process is the same crew', () => {
  const { stage, tick, now } = setup();
  const first = tick().sprites[0];
  stage.sync({ now: now(), sessions: [session({ id: 'next', since: now(), seenAt: now() })] });
  const second = tick().sprites[0];
  assert.deepEqual([second.x, second.palette], [first.x, first.palette]);
});
