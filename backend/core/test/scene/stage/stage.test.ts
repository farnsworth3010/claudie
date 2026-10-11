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

function setup(settings: object = {}, over: Partial<Session> = {}, random: () => number = Math.random) {
  let t = 100_000;
  const stage = new Stage(null, () => t, random);
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

test('with gravity, a crew let go of in mid-air falls to the bottom edge and stays there', () => {
  const { stage, tick, main, body } = setup({ gravity: true });
  for (let i = 0; i < 60; i++) tick();
  const floor = SCREEN.area.y + SCREEN.area.height;
  assert.equal(main().y + GRID_H * PX, floor, 'drops from its margin on its own');
  stage.takeActions();
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x - 200, from.y - 400);
  for (let i = 0; i < 60; i++) tick();
  assert.ok(main().y + GRID_H * PX < floor - 300, 'held up in the air');
  stage.release();
  const x = main().x;
  for (let i = 0; i < 200; i++) tick();
  assert.equal(main().y + GRID_H * PX, floor);
  assert.equal(main().x, x, 'without inertia it drops straight down');
  assert.deepEqual(stage.takeActions(), [{ type: 'anchor', anchor: { screen: 7, right: 24 + 200, bottom: 0 } }]);
});

test('with inertia, a flung crew flies on past the pointer, slows down and rests where it stops', () => {
  const { stage, tick, main, body } = setup({ inertia: true });
  tick();
  const from = body();
  stage.press(from.x, from.y);
  for (let i = 1; i <= 10; i++) {
    stage.motion(from.x - i * 30, from.y);
    tick();
  }
  stage.release();
  const target = main().x;
  for (let i = 0; i < 300; i++) tick();
  assert.ok(main().x < target - 50, `carried on to ${main().x}, from ${target}`);
  const [action] = stage.takeActions();
  assert.equal(action?.type, 'anchor');
  const rested = main().x;
  for (let i = 0; i < 30; i++) tick();
  assert.equal(main().x, rested, 'and stays');
});

test('with inertia, a crew flung at an edge bounces back off it', () => {
  const { stage, tick, main, body } = setup({ inertia: true });
  tick();
  const from = body();
  stage.press(from.x, from.y);
  for (let i = 1; i <= 10; i++) {
    stage.motion(from.x - i * 150, from.y);
    tick();
  }
  stage.release();
  let leftmost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 300; i++) leftmost = Math.min(leftmost, tick().sprites.at(-1)?.x ?? leftmost);
  assert.ok(leftmost <= 0, 'reaches the left edge');
  assert.ok(main().x > leftmost, 'and comes off it');
});

test('a crew flung hard at the side of the screen flinches against it', () => {
  const { stage, tick, body } = setup({ inertia: true });
  const pixels = new Map<number, string>();
  const drawn = (view: ReturnType<typeof tick>) => {
    const s = view.sprites.at(-1);
    if (s?.pixels) pixels.set(s.id, s.pixels.join());
    return pixels.get(s?.id ?? -1) ?? '';
  };
  const bump = new Set<string>();
  for (let t = 0; t < clipDuration('bumpLeft'); t += 5) bump.add(frameAt('bumpLeft', t).pixels.join());
  drawn(tick());
  const from = body();
  stage.press(from.x, from.y);
  for (let i = 1; i <= 10; i++) {
    stage.motion(from.x - i * 150, from.y);
    drawn(tick());
  }
  stage.release();
  const after = Array.from({ length: 120 }, () => drawn(tick()));
  assert.ok(
    after.some((p) => bump.has(p)),
    'plays the bump against the left edge',
  );
});

test('wandering, a crew walks off along the floor on its own after a rest, and rests again', () => {
  const { tick, main } = setup({ wander: true }, {}, () => 0.2); // walks backwards (left), short rests
  tick();
  const start = main().x;
  for (let i = 0; i < 100; i++) tick(); // still resting
  assert.equal(main().x, start);
  for (let i = 0; i < 300; i++) tick();
  assert.ok(main().x < start, `walked from ${start} to ${main().x}`);
  assert.equal(main().h, GRID_H, 'upright on the floor');
});

test('wandering without gravity, it climbs the wall at the end of the floor, turned with its feet on it', () => {
  const { tick } = setup({ wander: true }, {}, () => 0.9); // always forwards (rightwards, then up)
  let turned: ReturnType<typeof tick>['sprites'][number] | undefined;
  for (let i = 0; i < 4000 && !turned; i++) turned = tick(50).sprites.find((s) => s.w === GRID_H);
  assert.ok(turned, 'turned onto the wall');
  assert.equal(turned.x + turned.w * PX, SCREEN.area.x + SCREEN.area.width, 'feet against the right edge');
});

test('wandering with gravity, it never leaves the floor', () => {
  const { tick } = setup({ wander: true, gravity: true }, {}, () => 0.9);
  for (let i = 0; i < 40; i++) tick(); // drops from its margin first
  const floor = SCREEN.area.y + SCREEN.area.height;
  for (let i = 0; i < 4000; i++) {
    const s = tick(50).sprites.at(-1);
    assert.ok(s && s.w !== GRID_H && s.y + s.h * PX === floor, `step ${i}`);
  }
});

test('gravity turned on while it crawls on a wall pulls it down to the floor', () => {
  let t = 100_000;
  const stage = new Stage(
    null,
    () => t,
    () => 0.9,
  );
  stage.setScreens([SCREEN]);
  const sync = (settings: object) =>
    stage.sync({ now: t, sessions: [session({ since: t, seenAt: t })], settings: { size: PX, ...settings } });
  const tick = () => {
    t += 50;
    return stage.tick(null).sprites.at(-1);
  };
  sync({ wander: true });
  let s = tick();
  for (let i = 0; i < 4000 && s?.w !== GRID_H; i++) s = tick();
  assert.equal(s?.w, GRID_H, 'on the wall');
  sync({ wander: true, gravity: true });
  for (let i = 0; i < 100; i++) s = tick();
  assert.equal(s?.w, 20, 'upright again');
  assert.equal((s?.y ?? 0) + (s?.h ?? 0) * PX, SCREEN.area.y + SCREEN.area.height, 'on the floor');
});

test('on a wall a crew still takes the mouse on its drawn body, turned', () => {
  const { stage, tick } = setup({ wander: true }, {}, () => 0.9);
  const pixels = new Map<number, number[]>();
  let s = tick(50).sprites.at(-1);
  for (let i = 0; i < 4000 && s?.w !== GRID_H; i++) {
    for (const sprite of tick(50).sprites) if (sprite.pixels) pixels.set(sprite.id, sprite.pixels);
    s = tick(0).sprites.at(-1);
  }
  assert.ok(s && s.w === GRID_H);
  const drawn = pixels.get(s.id) ?? s.pixels ?? [];
  const i = drawn.findIndex((color) => color !== 0);
  const on = { x: s.x + (i % s.w) * PX + PX / 2, y: s.y + Math.floor(i / s.w) * PX + PX / 2 };
  assert.equal(stage.hit(on.x, on.y), true, 'a drawn pixel');
  assert.equal(stage.hit(s.x - 50, s.y - 50), false, 'empty space');
});

test('subagents past the last slot show as a +N badge in the corner', () => {
  const agents = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `a${i}`, type: 'Explore', startedAt: 0, seenAt: 100_000 }));
  const badge = (view: ReturnType<ReturnType<typeof setup>['tick']>) => view.sprites.find((s) => s.h === 7);
  const six = setup({}, { activity: 'delegating', agents: agents(6) });
  assert.equal(badge(six.tick()), undefined, 'six fit');
  const eight = setup({}, { activity: 'delegating', agents: agents(8) });
  const shown = badge(eight.tick());
  assert.ok(shown, 'two more than fit');
  assert.equal(shown.w, 9, 'reads +2');
});

test('wandering without gravity, a crew dragged to an edge turns onto it, and stays there let go of', () => {
  const { stage, tick, body } = setup({ wander: true }, {}, () => 0.5);
  tick();
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x + 2000, from.y - 300);
  let s = tick().sprites.at(-1);
  for (let i = 0; i < 30; i++) s = tick().sprites.at(-1);
  assert.equal(s?.w, GRID_H, 'turned while held against the right edge');
  assert.equal((s?.x ?? 0) + (s?.w ?? 0) * PX, SCREEN.area.x + SCREEN.area.width, 'feet on it');
  stage.motion(from.x - 300, from.y - 300);
  for (let i = 0; i < 30; i++) s = tick().sprites.at(-1);
  assert.equal(s?.w, 20, 'upright again pulled away');
  stage.motion(from.x + 2000, from.y - 300);
  for (let i = 0; i < 30; i++) tick();
  stage.release();
  for (let i = 0; i < 100; i++) s = tick().sprites.at(-1);
  assert.equal(s?.w, GRID_H, 'still on the wall after the release');
});

test('with gravity, a crew dragged to an edge stays upright', () => {
  const { stage, tick, body } = setup({ wander: true, gravity: true }, {}, () => 0.5);
  for (let i = 0; i < 40; i++) tick();
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x + 2000, from.y - 300);
  for (let i = 0; i < 30; i++) assert.equal(tick().sprites.at(-1)?.w, 20);
});

test('each walk goes at its own pace, never a fast one', () => {
  let seed = 1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const { tick, main } = setup({ wander: true, gravity: true }, {}, random);
  for (let i = 0; i < 40; i++) tick(); // lands from its margin
  // A walk: from its first step to its last, the slow ticks that round to no move included.
  const paces: number[] = [];
  let walked = 0;
  let ticks = 0;
  let still = 0;
  let x = main().x;
  for (let i = 0; i < 6000; i++) {
    tick(16);
    const now = main().x;
    if (now !== x) {
      walked += Math.abs(now - x);
      ticks += still + 1;
      still = 0;
    } else if (ticks && ++still > 10) {
      if (walked > 50) paces.push(walked / (ticks * 16));
      walked = 0;
      ticks = 0;
      still = 0;
    }
    x = now;
  }
  assert.ok(paces.length >= 3, `${paces.length} walks`);
  for (const pace of paces) assert.ok(pace > 0.02 && pace < 0.06, `${pace} points per ms`);
  assert.ok(Math.max(...paces) - Math.min(...paces) > 0.005, `paces ${paces.map((p) => p.toFixed(3))}`);
});

test('woken up, a wandering crew stands a while before it walks off', () => {
  const { tick, main, sync, now } = setup({ wander: true, gravity: true }, { since: 100_000 - 120_000 }, () => 0.5);
  for (let i = 0; i < 40; i++) tick(); // lands from its margin
  const asleep = main().x;
  for (let i = 0; i < 200; i++) tick(50);
  assert.equal(main().x, asleep, 'sleeping, it stays');
  sync({ activity: 'working', tool: 'Edit', since: now() });
  for (let i = 0; i < 78; i++) {
    tick(50);
    assert.equal(main().x, asleep, `still standing ${(i + 1) * 50} ms after waking`);
  }
  for (let i = 0; i < 200 && main().x === asleep; i++) tick(50);
  assert.notEqual(main().x, asleep, 'and then walks');
});

test('with neither inertia nor gravity, a crew dragged against an edge stops there without a bump', () => {
  const { stage, tick, body } = setup();
  const pixels = new Map<number, string>();
  const drawn = (view: ReturnType<typeof tick>) => {
    const s = view.sprites.at(-1);
    if (s?.pixels) pixels.set(s.id, s.pixels.join());
    return pixels.get(s?.id ?? -1) ?? '';
  };
  const bump = new Set<string>();
  for (let t = 0; t < clipDuration('bumpLeft'); t += 5) bump.add(frameAt('bumpLeft', t).pixels.join());
  drawn(tick());
  const from = body();
  stage.press(from.x, from.y);
  stage.motion(from.x - 3000, from.y);
  const held = Array.from({ length: 150 }, () => drawn(tick()));
  assert.ok(!held.some((p) => bump.has(p)), 'no bump against the left edge');
});

test('a wandering crew stays where it is when the group grows, or when the daemon is away a moment', () => {
  let t = 100_000;
  const stage = new Stage(
    null,
    () => t,
    () => 0.9,
  );
  stage.setScreens([SCREEN]);
  const one = [session({ since: t, seenAt: t })];
  const sync = (sessions: Session[]) => stage.sync({ now: t, sessions, settings: { size: PX, wander: true } });
  const main = () => {
    t += 50;
    return stage.tick(null).sprites.find((s) => s.w === GRID_H || s.w === 20);
  };
  sync(one);
  let s = main();
  for (let i = 0; i < 4000 && s?.w !== GRID_H; i++) s = main();
  for (let i = 0; i < 400; i++) s = main(); // well up the right wall, resting or walking
  assert.equal(s?.w, GRID_H, 'on the right wall');
  // A second session joins: the group gets wider, and the walls effectively shorter.
  sync([...one, session({ id: 's2', pid: 2, cwd: '/p/other', project: 'other', since: t, seenAt: t, startedAt: t })]);
  for (let i = 0; i < 5; i++) s = main();
  assert.equal(s?.w, GRID_H, 'still on the right wall, not thrown to another side');
  sync(one);
  for (let i = 0; i < 60; i++) s = main();
  const before = { x: s?.x, y: s?.y, w: s?.w };
  // The daemon goes away for a moment: everyone leaves, then comes back.
  sync([]);
  for (let i = 0; i < 60; i++) main();
  sync([session({ since: t, seenAt: t, startedAt: t - 10_000 })]);
  const back = main();
  assert.ok(back && back.w === before.w && Math.abs(back.x - (before.x ?? 0)) <= 2, 'back on the same wall');
  assert.ok(Math.abs((back?.y ?? 0) - (before.y ?? 0)) <= 4 * PX, `back near where it was: ${back?.y} vs ${before.y}`);
});

test('roaming anywhere, a crew walks all over the screen, upright, and stays on it', () => {
  let seed = 3;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const { tick } = setup({ wander: true, anywhere: true }, {}, random);
  const { area } = SCREEN;
  let inland = false;
  for (let i = 0; i < 6000; i++) {
    const s = tick(50).sprites.at(-1);
    assert.ok(s && s.w === 20, `upright at step ${i}`);
    assert.ok(s.x >= area.x - 3 * PX && s.x + s.w * PX <= area.x + area.width + 3 * PX, `on screen at ${i}`);
    assert.ok(s.y >= area.y && s.y + s.h * PX <= area.y + area.height, `on screen at ${i}`);
    inland ||= s.y + s.h * PX < area.y + area.height - 100 && s.y > area.y + 100;
  }
  assert.ok(inland, 'away from every edge at some point');
});

test('with gravity, roaming anywhere still keeps to the floor', () => {
  const { tick } = setup({ wander: true, anywhere: true, gravity: true }, {}, () => 0.3);
  for (let i = 0; i < 40; i++) tick();
  const floor = SCREEN.area.y + SCREEN.area.height;
  for (let i = 0; i < 2000; i++) {
    const s = tick(50).sprites.at(-1);
    assert.equal((s?.y ?? 0) + (s?.h ?? 0) * PX, floor, `step ${i}`);
  }
});

test('minis are never drawn more than half the main mascot, whatever the size rounds to', () => {
  for (const size of [2, 3, 4, 5, 7, 9]) {
    const { tick } = setup(
      { size },
      { activity: 'delegating', agents: [{ id: 'a', type: 'Explore', startedAt: 0, seenAt: 100_000 }] },
    );
    const sprites = tick().sprites.filter((s) => s.h === 22);
    const main = Math.max(...sprites.map((s) => s.px));
    for (const s of sprites) if (s.px !== main) assert.ok(s.px * 2 <= main, `size ${size}: ${s.px} vs ${main}`);
  }
});

test('the minis follow the mini size setting, as a share of the main mascot', () => {
  const agents = [{ id: 'a', type: 'Explore', startedAt: 0, seenAt: 100_000 }];
  const pxOf = (miniSize: number) => {
    const sprites = setup({ size: 8, miniSize }, { activity: 'delegating', agents }).tick().sprites;
    const main = Math.max(...sprites.map((s) => s.px));
    return { main, mini: Math.min(...sprites.filter((s) => s.h === 22).map((s) => s.px)) };
  };
  assert.deepEqual(pxOf(0.5), { main: 8, mini: 4 });
  assert.deepEqual(pxOf(1), { main: 8, mini: 8 });
  assert.deepEqual(pxOf(0.3), { main: 8, mini: 2 });
});

test('a crew too big to keep clear of the edges still goes where it is dragged, wandering or not', () => {
  let t = 100_000;
  const stage = new Stage(
    null,
    () => t,
    () => 0.5,
  );
  stage.setScreens([SCREEN]);
  const sessions = Array.from({ length: 7 }, (_, i) =>
    session({ id: `s${i}`, pid: i + 1, cwd: `/p/${i}`, project: `${i}`, since: t, seenAt: t, startedAt: t - 10_000 }),
  );
  stage.sync({ now: t, sessions, settings: { size: 8, wander: true } });
  const view = () => {
    t += 16;
    return stage.tick(null);
  };
  for (let i = 0; i < 60; i++) view();
  const sprites = view().sprites;
  const width = Math.max(...sprites.map((s) => s.x + s.w * s.px)) - Math.min(...sprites.map((s) => s.x));
  assert.ok(width > SCREEN.area.height, `a big crew: ${width} wide`);
  const main = sprites.find((s) => s.px === Math.max(...sprites.map((q) => q.px))) ?? sprites[0];
  const from = { x: main.x + 10 * main.px, y: main.y + 15 * main.px };
  assert.ok(stage.press(from.x, from.y));
  stage.motion(from.x, from.y - 300);
  let after = view().sprites;
  for (let i = 0; i < 60; i++) after = view().sprites;
  const top = (list: typeof sprites) => Math.min(...list.map((s) => s.y));
  assert.ok(top(after) < top(sprites) - 250, `lifted: ${top(sprites)} -> ${top(after)}`);
  assert.ok(
    after.every((s) => s.h === 22 || s.h === 7),
    'upright in the hand',
  );
});

test('a wide crew picked up off a wall comes away with the pointer instead of clinging on', () => {
  let t = 100_000;
  const stage = new Stage(
    null,
    () => t,
    () => 0.9,
  );
  stage.setScreens([SCREEN]);
  const agents = Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, type: 'Explore', startedAt: 0, seenAt: t }));
  const sessions = [
    session({ since: t, seenAt: t, startedAt: t - 10_000, activity: 'delegating', agents }),
    session({ id: 's2', pid: 2, cwd: '/p/b', project: 'b', since: t, seenAt: t, startedAt: t - 10_000 }),
  ];
  stage.sync({ now: t, sessions, settings: { size: 5, wander: true } });
  const pixels = new Map<number, number[]>();
  const view = () => {
    t += 50;
    const v = stage.tick(null);
    for (const s of v.sprites) if (s.pixels) pixels.set(s.id, s.pixels);
    return v.sprites;
  };
  let sprites = view();
  for (let i = 0; i < 6000 && !sprites.some((s) => s.w === GRID_H && s.px === 5); i++) sprites = view();
  const main = sprites.find((s) => s.w === GRID_H && s.px === 5);
  assert.ok(main, 'up on a wall');
  const drawn = pixels.get(main.id) ?? [];
  const i = drawn.findIndex((c) => c !== 0);
  const from = { x: main.x + (i % main.w) * main.px + 2, y: main.y + Math.floor(i / main.w) * main.px + 2 };
  assert.ok(stage.press(from.x, from.y), 'grabbed');
  stage.motion(from.x - 150, from.y);
  for (let k = 0; k < 40; k++) sprites = view();
  const right = Math.max(...sprites.map((s) => s.x + s.w * s.px));
  assert.ok(
    sprites.every((s) => s.h === 22 || s.h === 7),
    'upright in the hand',
  );
  assert.ok(right < SCREEN.area.x + SCREEN.area.width - 60, `pulled off the wall: right edge at ${right}`);
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
