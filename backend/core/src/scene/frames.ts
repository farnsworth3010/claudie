import { clamp } from '../shared/math.ts';
import { SKINS } from './art/skins.ts';
import { CLIPS } from './clips/clips.ts';
import { SCENES } from './clips/fidgets.ts';
import { durationOf } from './clips/steps.ts';
import { GRID_H, GRID_W, SOLID } from './constants/grid.ts';
import { PAL } from './constants/look.ts';
import { AGENT_LEAVE_MS, FADE_MS, SPIN_MS, SWEAT_MS, SWEAT_STEP_MS, WALK_MS } from './constants/timing.ts';
import { draw } from './draw/draw.ts';
import type { Clip, DrawnFrame, FidgetScene, Frame, FrameMods, Gaze, Step } from './types.ts';

const UNIT = [0, 1] as const;

// What each step has been drawn as, by the modifiers it was drawn with.
const cache = new WeakMap<Step, Map<string, DrawnFrame>>();

export function frameAt(clip: Clip, elapsed: number, mods: FrameMods = {}): Frame {
  return play(clip, CLIPS[clip].steps, CLIPS[clip].loop, elapsed, mods);
}

// One fidget pastime on its own, looping; the preview shows them side by side.
export function sceneFrameAt(scene: FidgetScene, elapsed: number, mods: FrameMods = {}): Frame {
  return play('fidget', SCENES[scene], true, elapsed, mods);
}

const wrap = (v: number, period: number): number => ((v % period) + period) % period;

function stepAt(steps: readonly Step[], loop: boolean, elapsed: number): Step {
  const total = durationOf(steps);
  let t = loop ? wrap(elapsed, total) : clamp(elapsed, [0, total - 1]);
  for (const step of steps) {
    if (t < step.ms) return step;
    t -= step.ms;
  }
  return steps[steps.length - 1];
}

// Drawn facing right and flipped afterwards, so the eyes look the other way before the flip.
function gazeForDrawing(gaze: Gaze | undefined, mirror: boolean): Gaze | undefined {
  return gaze && mirror ? { x: -gaze.x as Gaze['x'], y: gaze.y } : gaze;
}

function drawnFrame(step: Step, mods: FrameMods, elapsed: number): DrawnFrame {
  const sick = mods.sick ?? 0;
  // The sweat drop cycles on the elapsed time, independent of the clip's steps.
  const sweat = sick > 0 ? Math.floor(wrap(elapsed, SWEAT_MS) / SWEAT_STEP_MS) : -1;
  const blades = mods.skin ? (SKINS[mods.skin].spin?.frames.length ?? 0) : 0;
  const spin = blades ? Math.floor(wrap(elapsed / SPIN_MS, blades)) : -1;
  const mirror = mods.mirror ?? false;
  const gaze = gazeForDrawing(mods.gaze, mirror);
  const key = `${mods.skin ?? ''}|${spin}|${sick}|${sweat}|${gaze ? `${gaze.x},${gaze.y}` : ''}|${mods.bubble ?? ''}${mirror ? '|m' : ''}`;

  let byMods = cache.get(step);
  if (!byMods) {
    byMods = new Map();
    cache.set(step, byMods);
  }
  const cached = byMods.get(key);
  if (cached) return cached;

  const drawnRight = draw(step.pose, { skin: mods.skin, spin, sick, sweat, gaze, bubble: mods.bubble });
  const pixels = mirror ? flip(drawnRight) : drawnRight;
  const drawn = { pixels, solid: solidColumns(pixels) };
  byMods.set(key, drawn);
  return drawn;
}

// Walking in or off slides the mascot across, by `walk` (0..1) of the way.
function slideOf(clip: Clip, walk: number): number {
  if (clip === 'enter') return (1 - walk) * GRID_W;
  if (clip === 'leave') return walk * GRID_W;
  return 0;
}

function opacityOf(clip: Clip, walk: number, elapsed: number): number {
  if (clip === 'enter') return walk;
  if (clip === 'leave') return 1 - walk;
  if (clip === 'deliver') return clamp((AGENT_LEAVE_MS - elapsed) / FADE_MS, UNIT);
  return 1;
}

function play(clip: Clip, steps: readonly Step[], loop: boolean, elapsed: number, mods: FrameMods): Frame {
  // A handover is timed to the mini's walk across the screen, so it keeps real time.
  const played = clip === 'deliver' ? elapsed : elapsed * (mods.pace ?? 1);
  const step = stepAt(steps, loop, played);
  const drawn = drawnFrame(step, mods, played);
  const walk = clamp(elapsed / WALK_MS, UNIT);
  const dx = slideOf(clip, walk) + (step.pose.dx ?? 0) * (mods.mirror ? -1 : 1);
  return {
    w: GRID_W,
    h: GRID_H,
    pixels: drawn.pixels,
    dx,
    opacity: opacityOf(clip, walk, elapsed),
    solid: drawn.solid,
  };
}

function flip(pixels: Uint8Array): Uint8Array {
  const out = new Uint8Array(pixels.length);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) out[y * GRID_W + x] = pixels[y * GRID_W + GRID_W - 1 - x];
  }
  return out;
}

// The columns [from, to) the body covers; the standing span when nothing is drawn.
function solidColumns(pixels: Uint8Array): readonly [number, number] {
  let from = GRID_W;
  let to = 0;
  pixels.forEach((color, i) => {
    if (color !== PAL.body) return;
    from = Math.min(from, i % GRID_W);
    to = Math.max(to, (i % GRID_W) + 1);
  });
  return from < to ? [from, to] : SOLID;
}
