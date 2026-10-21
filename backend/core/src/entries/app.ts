// The Mac app's side of the core, bundled into frontends/macos/src/Resources/scene.js and run in
// JavaScriptCore. Everything structured crosses as a JSON string; a NaN pointer means there is none.
import { chirpWav } from '../scene/sound/chirp.ts';
import { type Anchor, Stage } from '../scene/stage/stage.ts';

let stage = new Stage();

const api = {
  // `anchor`: '' or what the last 'anchor' action said.
  start: (anchor: string): void => {
    stage = new Stage(anchor ? (JSON.parse(anchor) as Anchor) : null);
  },
  setScreens: (screens: string): void => stage.setScreens(JSON.parse(screens)),
  sync: (snapshot: string): void => stage.sync(JSON.parse(snapshot)),
  tick: (x: number, y: number): string => JSON.stringify(stage.tick(Number.isNaN(x) ? null : { x, y })),
  hit: (x: number, y: number): boolean => stage.hit(x, y),
  press: (x: number, y: number): boolean => stage.press(x, y),
  motion: (x: number, y: number): void => stage.motion(x, y),
  release: (): void => stage.release(),
  zoom: (delta: number): void => stage.zoom(delta),
  idle: (idleMs: number): void => stage.idle(idleMs),
  takeActions: (): string => JSON.stringify(stage.takeActions()),
  // The WAV bytes of the sound three clicks make.
  chirp: (): string => JSON.stringify([...chirpWav()]),
};

(globalThis as Record<string, unknown>).claudie = api;
