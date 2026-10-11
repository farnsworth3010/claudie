import { asNumber, asObject } from '../shared/json.ts';
import { clamp } from '../shared/math.ts';
import { DEFAULT_SETTINGS, FLAGS, RANGES } from './constants.ts';
import type { Settings, SettingsFlag, SettingsNumber } from './types.ts';

const isFlag = (key: string): key is SettingsFlag => (FLAGS as readonly string[]).includes(key);
const isNumber = (key: string): key is SettingsNumber => Object.hasOwn(RANGES, key);

// Whatever was stored or received, merged over the defaults and kept in range; junk is ignored.
export function settingsFrom(raw: unknown): Settings {
  const input = asObject(raw);
  if (!input) return DEFAULT_SETTINGS;
  const numbers = Object.fromEntries(
    Object.entries(RANGES).flatMap(([key, range]) => {
      const value = asNumber(input[key]);
      if (value === undefined) return [];
      return [[key, clamp(key === 'size' ? Math.round(value) : value, range)]]; // size counts whole points
    }),
  );
  const flags = Object.fromEntries(
    FLAGS.flatMap((flag) => (typeof input[flag] === 'boolean' ? [[flag, input[flag]]] : [])),
  );
  return { ...DEFAULT_SETTINGS, ...numbers, ...flags };
}

// A change sent by a client: known fields of the right type only; undefined when anything is off.
export function settingsPatch(raw: unknown): Partial<Settings> | undefined {
  const input = asObject(raw);
  if (!input) return undefined;
  const patch: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    const valid = isNumber(key) ? asNumber(value) !== undefined : isFlag(key) && typeof value === 'boolean';
    if (!valid) return undefined;
    patch[key] = value as number | boolean;
  }
  return patch as Partial<Settings>;
}
