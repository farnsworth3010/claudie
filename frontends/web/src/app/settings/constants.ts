import type { SettingsFlag, SettingsNumber } from '@claudie/core/settings/types.ts';

export const SAVE_DELAY_MS = 150; // a moving slider's changes go out together once it rests
export const RESET_CONFIRM_MS = 3_000; // how long the reset button waits for the second click

export const FLAG_LABELS: Readonly<Record<SettingsFlag, string>> = {
  overFullscreen: 'Show over full-screen apps',
  clickThrough: 'Click through: clicks go past the Clawds; hold ⌥ Option to drag, poke or right-click them (macOS)',
  overDock: 'May stand on the Dock (macOS)',
  overMenuBar: 'May climb onto the menu bar (macOS)',
  gaze: 'Eyes follow the pointer',
  antics: 'Clown around when a dialog waits long',
  neglect: 'Cobwebs, a flower, snow and bones when idle long',
  inertia: 'Inertia: a thrown group keeps flying and bounces off the edges',
  gravity: 'Gravity: a group let go of falls to the bottom of the screen',
  wander: 'Wander: walks about and crawls along the screen edges (only the bottom one with gravity)',
  stroll: 'Stroll when idle: paces slowly instead of sleeping, gathering cobwebs and turning to bones',
  anywhere: 'Anywhere: wander all over the screen, not just its edges (with Wander, without Gravity)',
};

// A number setting as a slider: `scale` slider units per unit of the setting.
export interface SliderSpec {
  readonly key: SettingsNumber;
  readonly label: string;
  readonly scale: number;
  readonly step: number; // in slider units
  readonly caption: (value: number) => string; // of a value in slider units
}

const duration = (s: number): string => {
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  if (!minutes) return `${s} s`;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
};

export const SLIDERS: readonly SliderSpec[] = [
  { key: 'size', label: 'Size', scale: 1, step: 1, caption: (v) => `${v} pt per pixel` },
  { key: 'miniSize', label: 'Subagent size', scale: 100, step: 10, caption: (v) => `${v}% of the main` },
  { key: 'opacity', label: 'Opacity', scale: 100, step: 5, caption: (v) => `${v}%` },
  { key: 'pace', label: 'Animation speed', scale: 100, step: 10, caption: (v) => `${v}%` },
];

export const TIMING_SLIDERS: readonly SliderSpec[] = [
  { key: 'sleepAfter', label: 'Sleeps after', scale: 1, step: 5, caption: duration },
  { key: 'neglectAfter', label: 'Cobwebs after', scale: 1 / 60, step: 1, caption: (v) => `${v} min` },
  { key: 'patience', label: 'Antics after', scale: 1, step: 5, caption: duration },
];
