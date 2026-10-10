// Renders the README's images and GIFs into docs/media/ from the scene code itself, so they always
// show what the app draws. Needs ImageMagick (`magick`) to assemble the GIFs.
//   pnpm media
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SKIN_IDS } from '../../src/scene/art/skins.ts';
import { clipDuration } from '../../src/scene/clips/clips.ts';
import { frameAt } from '../../src/scene/frames.ts';
import { lookPalette, skinPalette } from '../../src/scene/look.ts';
import { Stage } from '../../src/scene/stage/stage.ts';
import type { Clip, FrameMods, SpriteDraw } from '../../src/scene/types.ts';
import type { Agent, Session } from '../../src/session/types.ts';
import { Canvas, type Rgb } from './png.ts';

const OUT = join(import.meta.dirname, '../../../../docs/media');
const BACKGROUND: Rgb = [43, 47, 54]; // reads on both GitHub's light and dark themes
const FRAME_MS = 50;
const GIF_DELAY = FRAME_MS / 10; // ImageMagick counts in hundredths of a second
const CLIP_SCALE = 4;
const CLIP_BOX = 24; // art pixels around a single Clawd: its 20×22 grid and a margin
const MAX_CLIP_MS = 4000;
const HERO_SIZE = 6;
const HERO_FRAMES = 80;
const HERO_MARGIN = 16;
const DEFAULT_LOOK = { hue: 0, size: 0 };

// The clips shown in the README's table, by the file name they get.
const CLIPS: ReadonlyArray<{ name: string; clip: Clip; ms?: number; mods?: FrameMods }> = [
  { name: 'type', clip: 'type' },
  { name: 'hammer', clip: 'hammer' },
  { name: 'search', clip: 'search' },
  { name: 'globe', clip: 'globe' },
  { name: 'work', clip: 'work' },
  { name: 'alert', clip: 'alert' },
  { name: 'ask', clip: 'ask' },
  { name: 'fidget', clip: 'fidget', ms: 9000 },
  { name: 'compact', clip: 'compact' },
  { name: 'sick', clip: 'stand', mods: { sick: 3 } },
  { name: 'celebrate', clip: 'celebrate' },
  { name: 'sad', clip: 'sad' },
  { name: 'puzzled', clip: 'puzzled' },
  { name: 'yawn', clip: 'yawn' },
  { name: 'confetti', clip: 'confetti' },
  { name: 'upset', clip: 'upset' },
  { name: 'refresh', clip: 'refresh' },
  { name: 'sleep', clip: 'sleep' },
  { name: 'cobweb', clip: 'cobweb' },
  { name: 'overgrown', clip: 'overgrown' },
  { name: 'snowedIn', clip: 'snowedIn' },
  { name: 'skeleton', clip: 'skeleton' },
  { name: 'highJump', clip: 'highJump' },
  { name: 'poke', clip: 'poke' },
  { name: 'chatA', clip: 'chatA' },
];

function writeGif(name: string, frames: readonly Canvas[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'claudie-media-'));
  try {
    for (const [i, frame] of frames.entries()) frame.save(join(dir, `${String(i).padStart(4, '0')}.png`));
    const args = ['-delay', String(GIF_DELAY), '-loop', '0', join(dir, '*.png'), '-layers', 'Optimize'];
    execFileSync('magick', [...args, join(OUT, `${name}.gif`)]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// One clip on its own, from its start, at most MAX_CLIP_MS of it.
function renderClip({ name, clip, ms, mods = {} }: (typeof CLIPS)[number]): void {
  const palette = lookPalette(DEFAULT_LOOK, mods.sick ?? 0);
  const length = ms ?? Math.min(clipDuration(clip), MAX_CLIP_MS);
  const frames: Canvas[] = [];
  for (let t = 0; t < length; t += FRAME_MS) {
    const frame = frameAt(clip, t, mods);
    const canvas = new Canvas(CLIP_BOX * CLIP_SCALE, CLIP_BOX * CLIP_SCALE, BACKGROUND);
    const margin = 2 * CLIP_SCALE;
    canvas.sprite(frame.pixels, frame.w, palette, margin + frame.dx * CLIP_SCALE, margin, CLIP_SCALE, frame.opacity);
    frames.push(canvas);
  }
  writeGif(`clip-${name}`, frames);
}

// Six sessions in a row, as the Mac app draws them: typing, a crew of subagents, a permission and a
// question waiting, a context nearly full, plan mode.
function renderHero(): void {
  let now = 1_000_000;
  const stage = new Stage(null, () => now);
  stage.setScreens([{ id: 1, area: { x: 0, y: 0, width: 2000, height: 500 } }]);
  const session = (id: string, project: string, more: Partial<Session>): Session => ({
    id,
    pid: Number(id),
    cwd: `/projects/${project}`,
    project,
    activity: 'idle',
    mood: 'none',
    agents: [],
    startedAt: now - 60_000,
    since: now - 3000,
    seenAt: now,
    ...more,
  });
  const agent = (id: string, type: string, tool?: string): Agent => ({
    id,
    type,
    tool,
    startedAt: now - 9000,
    seenAt: now,
  });
  stage.sync({
    now,
    settings: { size: HERO_SIZE },
    sessions: [
      session('1', 'api', { activity: 'working', tool: 'Edit' }),
      session('2', 'web', {
        activity: 'delegating',
        agents: [
          agent('a', 'Explore', 'Grep'),
          agent('b', 'code-reviewer'),
          agent('c', 'Plan'),
          agent('d', 'test-engineer', 'Bash'),
        ],
      }),
      session('3', 'infra', { activity: 'waiting', tool: 'Bash' }),
      session('4', 'docs', { activity: 'asking', tool: 'AskUserQuestion' }),
      session('5', 'ml', { activity: 'thinking', contextTokens: 860_000 }),
      session('6', 'app', { mode: 'plan', since: now - 20_000 }),
    ],
  });

  const views = Array.from({ length: HERO_FRAMES }, () => {
    const view = stage.tick(null);
    now += FRAME_MS;
    return view;
  });
  const sprites = views.flatMap((view) => view.sprites);
  const left = Math.min(...sprites.map((s) => s.x)) - HERO_MARGIN;
  const top = Math.min(...sprites.map((s) => s.y)) - HERO_MARGIN;
  const right = Math.max(...sprites.map((s) => s.x + s.w * s.px)) + HERO_MARGIN;
  const bottom = Math.max(...sprites.map((s) => s.y + s.h * s.px)) + HERO_MARGIN / 2;
  // A frame's pixels come only the first time its id is drawn, as in the app.
  const pixels = new Map<number, readonly number[]>();
  const draw = (canvas: Canvas, s: SpriteDraw) => {
    if (s.pixels) pixels.set(s.id, s.pixels);
    const known = pixels.get(s.id);
    if (known) canvas.sprite(known, s.w, s.palette.split(','), s.x - left, s.y - top, s.px, s.opacity);
  };
  writeGif(
    'hero',
    views.map((view) => {
      const canvas = new Canvas(right - left, bottom - top, BACKGROUND);
      for (const s of view.sprites) draw(canvas, s);
      return canvas;
    }),
  );
}

// Every subagent skin side by side, standing.
function renderSkins(): void {
  const cell = CLIP_BOX * CLIP_SCALE;
  const canvas = new Canvas(cell * SKIN_IDS.length, cell, BACKGROUND);
  SKIN_IDS.forEach((skin, i) => {
    const frame = frameAt('stand', 0, { skin });
    canvas.sprite(frame.pixels, frame.w, skinPalette(skin), i * cell + 2 * CLIP_SCALE, 2 * CLIP_SCALE, CLIP_SCALE);
  });
  canvas.save(join(OUT, 'skins.png'));
}

mkdirSync(OUT, { recursive: true });
renderHero();
for (const clip of CLIPS) renderClip(clip);
renderSkins();
console.log(`media written to ${OUT}`);
