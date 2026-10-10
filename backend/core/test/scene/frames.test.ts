import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKIN_IDS } from '../../src/scene/art/skins.ts';
import { CLIP_NAMES, CLIPS, clipDuration } from '../../src/scene/clips/clips.ts';
import { FIDGET_SCENES } from '../../src/scene/clips/fidgets.ts';
import { EYES, GRID_H, GRID_W } from '../../src/scene/constants/grid.ts';
import { PAL } from '../../src/scene/constants/look.ts';
import { AGENT_LEAVE_MS, HANDOVER_MS, WALK_MS } from '../../src/scene/constants/timing.ts';
import { frameAt, sceneFrameAt } from '../../src/scene/frames.ts';
import { lookPalette, sickness, skinPalette } from '../../src/scene/look.ts';
import type { Clip, Gaze } from '../../src/scene/types.ts';

const colorsIn = (clip: Clip) => {
  const seen = new Set<number>();
  for (let t = 0; t < clipDuration(clip); t += 20) for (const c of frameAt(clip, t).pixels) seen.add(c);
  return seen;
};
const has = (clip: Clip, ...slots: number[]) => {
  const colors = colorsIn(clip);
  for (const c of slots) assert.ok(colors.has(c), `${clip} draws slot ${c}`);
};
const inkAt = (clip: Clip, gaze?: Gaze, skin?: 'reviewer' | 'explorer') => {
  const f = frameAt(clip, 0, { gaze, skin });
  return [...f.pixels].flatMap((c, i) => (c === PAL.ink ? [[i % f.w, Math.floor(i / f.w)]] : []));
};

test('every clip renders full-size frames; bubbles and z appear where expected', () => {
  for (const clip of CLIP_NAMES) {
    const f = frameAt(clip, 0);
    assert.equal(f.pixels.length, GRID_W * GRID_H, clip);
    assert.ok(f.pixels.includes(clip === 'skeleton' ? PAL.white : PAL.body), `${clip} draws the body`);
  }
  has('alert', PAL.red);
  has('ask', PAL.blue);
  has('sleep', PAL.zed);
  assert.ok(!colorsIn('work').has(PAL.red));
  assert.equal(frameAt('enter', 0).opacity, 0);
  assert.equal(frameAt('enter', WALK_MS).dx, 0);
});

test('startled flinches once and stares, then settles back to standing', () => {
  assert.equal(CLIPS.startled.loop, false);
  const ms = clipDuration('startled');
  assert.ok(ms >= 1500 && ms <= 2000, `${ms} ms`);
  const flinch = frameAt('startled', 0);
  assert.notDeepEqual(flinch.pixels, frameAt('stand', 0).pixels);
  assert.ok(flinch.pixels.includes(PAL.shade), 'eyes squeezed shut');
  // The jolt leaps with the eyes wide open: three rows of lift at its peak.
  const jolt = frameAt('startled', 90 + 80 + 20);
  assert.ok(jolt.pixels.indexOf(PAL.body) < frameAt('stand', 0).pixels.indexOf(PAL.body), 'body lifted');
  assert.deepEqual(frameAt('startled', ms - 1).pixels, frameAt('stand', 0).pixels, 'ends standing');
  const frames = new Set<string>();
  for (let t = 0; t < ms; t += 10) frames.add(frameAt('startled', t).pixels.join());
  assert.ok(frames.size >= 6, `${frames.size} distinct frames`);
});

test('refused shakes its head with a red cross, slumps a little and ends standing', () => {
  assert.equal(CLIPS.refused.loop, false);
  const ms = clipDuration('refused');
  assert.ok(ms >= 1500 && ms <= 2000, `${ms} ms`);
  assert.notDeepEqual(frameAt('refused', 0).pixels, frameAt('stand', 0).pixels);
  // dx alternates one pixel each way, the eyes glancing along.
  const shakes = [0, 1, 2, 3, 4, 5].map((i) => frameAt('refused', i * 110 + 10).dx);
  assert.deepEqual(shakes, [-1, 1, -1, 1, -1, 1]);
  has('refused', PAL.red);
  assert.ok(!frameAt('refused', ms - 1).pixels.includes(PAL.red), 'the cross is gone by the end');
  assert.ok(frameAt('refused', 110 * 6 + 120 + 250).pixels.includes(PAL.shade), 'slumped with closed eyes');
  assert.deepEqual(frameAt('refused', ms - 1).pixels, frameAt('stand', 0).pixels, 'ends standing');
  assert.equal(frameAt('refused', ms - 1).dx, 0);
});

test('fidget cycles through cube, juggling, guitar and tea props', () => {
  const colors = new Set<number>();
  let mostBrown = 0;
  for (let t = 0; t < clipDuration('fidget'); t += 50) {
    const px = frameAt('fidget', t).pixels;
    for (const c of px) colors.add(c);
    mostBrown = Math.max(mostBrown, px.filter((c) => c === PAL.brown).length);
  }
  for (const c of [PAL.red, PAL.blue, PAL.yellow, PAL.green, PAL.white, PAL.brown, PAL.zed]) {
    assert.ok(colors.has(c), `colour ${c}`);
  }
  // Only the guitar is that much wood; the tea is a sip of brown.
  assert.ok(mostBrown > 20, `guitar drawn (${mostBrown} brown pixels)`);
});

test('each fidget scene draws something of its own', () => {
  for (const scene of ['spinner', 'sixSeven', 'pop'] as const) assert.ok(FIDGET_SCENES.includes(scene), scene);
  const plain = frameAt('stand', 0).pixels.join();
  const looks = FIDGET_SCENES.map((scene) => {
    const seen = new Set<string>();
    for (let t = 0; t < 6000; t += 100) seen.add(sceneFrameAt(scene, t).pixels.join());
    assert.ok(
      [...seen].some((p) => p !== plain),
      scene,
    );
    return [...seen].sort().join('|');
  });
  assert.equal(new Set(looks).size, FIDGET_SCENES.length);
});

test('the electric guitar is a black body with a long white neck, not the brown acoustic', () => {
  const count = (scene: 'guitar' | 'electric', color: number): number =>
    Math.max(
      ...Array.from({ length: 50 }, (_, i) => sceneFrameAt(scene, i * 100).pixels.filter((c) => c === color).length),
    );
  assert.ok(count('electric', PAL.white) >= 15, 'white neck and pickups');
  assert.ok(count('electric', PAL.ink) >= 30, 'black body');
  assert.equal(count('electric', PAL.brown), 0, 'no wood');
  assert.equal(count('guitar', PAL.white), 0, 'the acoustic has none of the white');
  assert.ok(count('guitar', PAL.brown) > 20);
});

test('every skin draws its accessory in its own colours', () => {
  for (const skin of SKIN_IDS) {
    const f = frameAt('work', 0, { skin });
    assert.ok(f.pixels.some((c) => c >= PAL.ink && c !== PAL.ink) || f.pixels.includes(PAL.ink), skin);
    assert.notEqual(skinPalette(skin)[PAL.body], lookPalette({ hue: 0, size: 0 })[PAL.body], skin);
  }
  const plain = frameAt('work', 0).pixels;
  for (const skin of SKIN_IDS) assert.notDeepEqual(frameAt('work', 0, { skin }).pixels, plain, skin);
});

test('sickness grows with context: sweat, then fever, then ice pack and shivers', () => {
  assert.deepEqual([undefined, 0, 0.49, 0.5, 0.64, 0.65, 0.79, 0.8, 1].map(sickness), [0, 0, 0, 1, 1, 2, 2, 3, 3]);
  const seen = (sick: number, c: number) => {
    for (let t = 0; t < 2400; t += 100) if (frameAt('stand', t, { sick }).pixels.includes(c)) return true;
    return false;
  };
  assert.ok(!seen(0, PAL.ice) && seen(1, PAL.ice));
  assert.ok(!seen(1, PAL.cheek) && seen(2, PAL.cheek));
  assert.notEqual(lookPalette({ hue: 0, size: 0 }, 3)[PAL.body], lookPalette({ hue: 0, size: 0 })[PAL.body]);
  assert.equal(frameAt('stand', 0, { sick: 3 }).dx, 0);
  assert.equal(frameAt('stand', 130, { sick: 3 }).dx, 1);
  assert.equal(frameAt('stand', 130, { sick: 2 }).dx, 0);
});

test('open eyes follow the gaze, closed ones and glasses-free hats stay put', () => {
  const centre = (pts: number[][]) =>
    pts.reduce(([x, y], [px, py]) => [x + px / pts.length, y + py / pts.length], [0, 0]);
  const [x0, y0] = centre(inkAt('stand'));
  assert.ok(Math.abs(x0 + 0.5 - EYES.x) < 0.01 && Math.abs(y0 + 0.5 - EYES.y) < 0.01);
  const [x1, y1] = centre(inkAt('stand', { x: 1, y: -1 }));
  assert.deepEqual([x1 - x0, y1 - y0], [1, -1]);
  assert.deepEqual(frameAt('sleep', 0, { gaze: { x: 1, y: 1 } }).pixels, frameAt('sleep', 0).pixels);
  // Glasses turn with the eyes, so the rims never cover them.
  const rims = (gaze?: Gaze) => {
    const f = frameAt('stand', 0, { skin: 'reviewer', gaze });
    return f.pixels.indexOf(PAL.acc1) % f.w;
  };
  assert.equal(rims({ x: 1, y: 0 }) - rims(), 1);
  assert.equal(inkAt('stand', { x: -1, y: 1 }, 'reviewer').length, inkAt('stand', undefined, 'reviewer').length);
});

test('bumps flatten the side that hit the wall and leave impact marks there', () => {
  const columns = (clip: 'bumpLeft' | 'bumpRight' | 'stand') => {
    const f = frameAt(clip, 0);
    const xs = [...f.pixels].flatMap((c, i) => (c === PAL.body ? [i % f.w] : []));
    return [Math.min(...xs), Math.max(...xs)];
  };
  const [l0, r0] = columns('stand');
  assert.ok(columns('bumpLeft')[0] > l0 && columns('bumpRight')[1] < r0);
  const yellowX = (clip: 'bumpLeft' | 'bumpRight') => {
    const f = frameAt(clip, 0);
    return [...f.pixels].flatMap((c, i) => (c === PAL.yellow ? [i % f.w] : []));
  };
  assert.ok(Math.max(...yellowX('bumpLeft')) < GRID_W / 2 && Math.min(...yellowX('bumpRight')) > GRID_W / 2);
  assert.ok(frameAt('bumpBottom', 0).pixels.includes(PAL.white), 'dust on the floor');
  assert.ok(frameAt('bumpTop', 80).pixels.includes(PAL.yellow), 'stars under the ceiling');
  // The flattened side reaches where the arm was, so it touches the edge, then bounces back.
  const hit = frameAt('bumpRight', 0);
  assert.equal(hit.solid[1] + hit.dx, frameAt('stand', 0).solid[1]);
  const left = frameAt('bumpLeft', 0);
  assert.equal(left.solid[0] + left.dx, frameAt('stand', 0).solid[0]);
  assert.ok(frameAt('bumpRight', 200).dx < 0, 'bounces back off the right wall');
});

test('a bubble is drawn over an antic that has none of its own', () => {
  assert.ok(frameAt('panic', 0, { bubble: 'bang' }).pixels.includes(PAL.red));
  assert.ok(frameAt('panic', 0, { bubble: 'question' }).pixels.includes(PAL.blue));
  assert.ok(!frameAt('panic', 0).pixels.includes(PAL.red));
});

test('a poke hops with a heart', () => {
  assert.ok(frameAt('poke', 300).pixels.includes(PAL.red), 'heart over the hop');
});

test('the neglect stages draw their own scenery', () => {
  const skeleton = (t: number) => frameAt('skeleton', t).pixels;
  const weed = (t: number) => skeleton(t).indexOf(PAL.brown) % GRID_W;
  assert.ok(weed(0) > weed(3_000), 'rolls from right to left');
  assert.ok(!skeleton(0).includes(PAL.body));
  has('cobweb', PAL.zed, PAL.ink);
  has('overgrown', PAL.green, PAL.cheek, PAL.yellow);
  has('snowedIn', PAL.white);
});

test('long legs lift the body while the feet stay on the floor', () => {
  const rows = (t: number) => {
    const f = frameAt('longLegs', t);
    const ys = [...f.pixels].flatMap((c, i) => (c === PAL.body ? [Math.floor(i / f.w)] : []));
    return [Math.min(...ys), Math.max(...ys)];
  };
  const [top0, feet0] = rows(0);
  const [top1, feet1] = rows(1_000);
  assert.equal(feet0, feet1);
  assert.equal(top0 - top1, 8);
});

test('tool, reaction and compaction clips draw their props', () => {
  has('type', PAL.zed, PAL.yellow, PAL.ink);
  has('hammer', PAL.brown, PAL.ink, PAL.yellow);
  has('search', PAL.ice, PAL.brown);
  has('globe', PAL.blue, PAL.green);
  has('confetti', PAL.red, PAL.blue, PAL.yellow, PAL.green);
  has('upset', PAL.zed, PAL.yellow, PAL.white);
  has('refresh', PAL.yellow, PAL.white);
  has('compact', PAL.yellow, PAL.blue);
  // The magnifier blows up the eye it passes over.
  const ink = (t: number) => [...frameAt('search', t).pixels].filter((c) => c === PAL.ink).length;
  assert.ok(ink(0) > ink(480));
});

test('mirror flips the frame, its solid columns and the gaze, so eyes still follow the pointer', () => {
  const flat = frameAt('deliver', HANDOVER_MS + 50, { skin: 'reviewer' });
  const flipped = frameAt('deliver', HANDOVER_MS + 50, { skin: 'reviewer', mirror: true });
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      assert.equal(flipped.pixels[y * GRID_W + x], flat.pixels[y * GRID_W + GRID_W - 1 - x]);
    }
  }
  assert.deepEqual(flipped.solid, [GRID_W - flat.solid[1], GRID_W - flat.solid[0]]);
  const eyesX = (mirror: boolean) => {
    const f = frameAt('stand', 0, { mirror, gaze: { x: 1, y: 0 } });
    const xs = [...f.pixels].flatMap((c, i) => (c === PAL.ink ? [i % f.w] : []));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.equal(eyesX(true), eyesX(false));
  assert.equal(frameAt('bumpRight', 0, { mirror: true }).dx, -frameAt('bumpRight', 0).dx);
});

test('a finished subagent holds its scroll out, then fades away', () => {
  assert.equal(clipDuration('deliver'), AGENT_LEAVE_MS);
  assert.ok(frameAt('deliver', HANDOVER_MS + 10).pixels.includes(PAL.yellow), 'scroll held out');
  assert.equal(frameAt('deliver', 0).opacity, 1);
  assert.ok(frameAt('deliver', AGENT_LEAVE_MS - 100).opacity < 0.5);
});

test('two chatting Clawds take equally long, the speaker with a bubble', () => {
  assert.ok(frameAt('chatA', 100).pixels.includes(PAL.white), 'speech bubble');
  assert.equal(clipDuration('chatA'), clipDuration('chatB'));
});

test('a skeleton has no eyes to move, only a red glint in each socket that follows the pointer', () => {
  const plain = frameAt('skeleton', 4_000).pixels;
  for (const x of [-1, 0, 1] as const) {
    for (const y of [-1, 0, 1] as const) {
      const looking = frameAt('skeleton', 4_000, { gaze: { x, y } }).pixels;
      const changed = [...looking].flatMap((c, i) => (c !== plain[i] ? [{ c, col: i % GRID_W }] : []));
      assert.deepEqual(
        changed.map((p) => p.c),
        Array(x === 0 ? 4 : 2).fill(PAL.red),
        `gaze ${x},${y}`,
      );
      // Both glints sit at the same place in their sockets, so the eyes never look apart.
      const half = changed.length / 2;
      const left = changed.slice(0, half).map((p) => p.col);
      const right = changed.slice(half).map((p) => p.col);
      assert.deepEqual(
        right.map((col) => col - right[0]),
        left.map((col) => col - left[0]),
        `gaze ${x},${y}`,
      );
      assert.equal(right[0] - left[0], 6, `gaze ${x},${y}`);
    }
  }
});
