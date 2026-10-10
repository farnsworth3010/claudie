import { asNumber, asObject } from '../shared/json.ts';
import { clamp } from '../shared/math.ts';
import { DEFAULT_SETTINGS, FLAGS, OPACITY_RANGE, SIZE_RANGE } from './constants.ts';
import type { Settings, SettingsFlag } from './types.ts';

const isFlag = (key: string): key is SettingsFlag => (FLAGS as readonly string[]).includes(key);

// Whatever was stored or received, merged over the defaults and kept in range; junk is ignored.
export function settingsFrom(raw: unknown): Settings {
  const input = asObject(raw);
  if (!input) return DEFAULT_SETTINGS;
  const size = asNumber(input.size);
  const opacity = asNumber(input.opacity);
  const flags = Object.fromEntries(
    FLAGS.flatMap((flag) => (typeof input[flag] === 'boolean' ? [[flag, input[flag]]] : [])),
  );
  return {
    ...DEFAULT_SETTINGS,
    ...(size !== undefined && { size: clamp(Math.round(size), SIZE_RANGE) }),
    ...(opacity !== undefined && { opacity: clamp(opacity, OPACITY_RANGE) }),
    ...flags,
  };
}

// A change sent by a client: known fields of the right type only; undefined when anything is off.
export function settingsPatch(raw: unknown): Partial<Settings> | undefined {
  const input = asObject(raw);
  if (!input) return undefined;
  const patch: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    const valid =
      key === 'size' || key === 'opacity' ? asNumber(value) !== undefined : isFlag(key) && typeof value === 'boolean';
    if (!valid) return undefined;
    patch[key] = value as number | boolean;
  }
  return patch as Partial<Settings>;
}
