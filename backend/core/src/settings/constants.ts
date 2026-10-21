import type { Settings, SettingsFlag, SettingsNumber } from './types.ts';

export const DEFAULT_SETTINGS: Settings = {
  size: 4,
  opacity: 1,
  miniSize: 0.5,
  pace: 1,
  overFullscreen: false,
  clickThrough: false,
  overDock: true,
  overMenuBar: false,
  gaze: true,
  antics: true,
  neglect: true,
  inertia: false,
  gravity: false,
  wander: false,
  stroll: false,
  anywhere: false,
  limits: false,
  clockInertia: false,
  clockGravity: false,
  sleepAfter: 45,
  neglectAfter: 300,
  patience: 30,
};

// What each number may be; anything outside is brought back in.
export const RANGES: Readonly<Record<SettingsNumber, readonly [number, number]>> = {
  size: [2, 12],
  opacity: [0.2, 1], // never fades out completely
  miniSize: [0.3, 1],
  pace: [0.5, 1.5],
  sleepAfter: [10, 600],
  neglectAfter: [60, 3600],
  patience: [5, 300],
};
export const FLAGS: readonly SettingsFlag[] = [
  'overFullscreen',
  'clickThrough',
  'overDock',
  'overMenuBar',
  'gaze',
  'antics',
  'neglect',
  'inertia',
  'gravity',
  'wander',
  'stroll',
  'anywhere',
  'limits',
  'clockInertia',
  'clockGravity',
];
