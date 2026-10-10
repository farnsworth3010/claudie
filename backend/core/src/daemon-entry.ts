// The daemon's side of the core, bundled into backend/daemon/src/core.js and run by the Go daemon in goja.
// Everything crosses the boundary as JSON strings, so the Go side needs no knowledge of the types.
import { Sessions } from './sessions.ts';

const sessions = new Sessions();

(globalThis as Record<string, unknown>).claudie = {
  hook: (envelope: string): boolean => sessions.hook(JSON.parse(envelope)),
  snapshot: (now: number): string => JSON.stringify(sessions.snapshot(now)),
};
