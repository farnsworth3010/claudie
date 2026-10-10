import type { Settings, SettingsFlag } from './types.ts';

export const DEFAULT_SETTINGS: Settings = {
  size: 4,
  opacity: 1,
  overFullscreen: false,
  gaze: true,
  antics: true,
  neglect: true,
};

export const SIZE_RANGE = [2, 12] as const;
export const OPACITY_RANGE = [0.2, 1] as const; // never fades out completely
export const FLAGS: readonly SettingsFlag[] = ['overFullscreen', 'gaze', 'antics', 'neglect'];
