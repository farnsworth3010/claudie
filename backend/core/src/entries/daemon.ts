// The daemon's side of the core, bundled into backend/daemon/src/core.js and run by the Go daemon in goja.
// Everything crosses the boundary as JSON strings, so the Go side needs no knowledge of the types.
import { limitsFrom } from '../limits/limits.ts';
import type { Limits } from '../limits/types.ts';
import { Sessions } from '../session/sessions.ts';
import { transcriptNote } from '../session/transcript.ts';
import type { Session, Snapshot } from '../session/types.ts';
import { settingsFrom, settingsPatch } from '../settings/settings.ts';
import type { Settings } from '../settings/types.ts';

const sessions = new Sessions();
let settings: Settings = settingsFrom(undefined);
let limits: Limits | undefined;

const api = {
  hook: (envelope: string): boolean => sessions.hook(JSON.parse(envelope)),
  // One line of a session's transcript, as read from the file.
  transcript: (id: string, line: string): boolean => {
    const note = transcriptNote(line);
    return note !== undefined && sessions.transcript(id, note);
  },
  // `alive` tells whether a process is still a running Claude Code.
  tick: (now: number, alive: (pid: number) => boolean): boolean => sessions.tick(now, alive),
  transcripts: (): string => JSON.stringify(sessions.transcripts()),
  // With none, the daemon's timers rest.
  count: (): number => sessions.list().length,
  snapshot: (now: number): string =>
    JSON.stringify({ now, sessions: sessions.list(), settings, ...(limits && { limits }) } satisfies Snapshot),
  // The status line's input; whether the limits in it are news. One without limits leaves the last ones.
  limits: (raw: string): boolean => {
    const next = limitsFrom(JSON.parse(raw));
    if (!next || JSON.stringify(next) === JSON.stringify(limits)) return false;
    limits = next;
    return true;
  },
  // The sessions to keep across restarts, and back.
  save: (): string => JSON.stringify(sessions.list()),
  restore: (saved: string): void => {
    const list: unknown = JSON.parse(saved);
    if (Array.isArray(list)) sessions.restore(list as Session[]);
  },
  settings: (): string => JSON.stringify(settings),
  // Whatever was in the settings file; junk falls back to the defaults.
  loadSettings: (raw: string): void => {
    settings = settingsFrom(JSON.parse(raw));
  },
  // A client's change: '' when it is refused, else the settings after it.
  updateSettings: (raw: string): string => {
    const patch = settingsPatch(JSON.parse(raw));
    if (!patch) return '';
    settings = settingsFrom({ ...settings, ...patch });
    return JSON.stringify(settings);
  },
};

(globalThis as Record<string, unknown>).claudie = api;
