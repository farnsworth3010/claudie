import GLib from 'gi://GLib';
import { IDLE_POLL_S } from '../lib/constants.ts';

// How long since the last keyboard or mouse input, from Mutter's idle monitor, every few seconds.
// Apart from the frame timer, which stops with nothing on screen; the time at the screen counts anyway.
export class IdleWatch {
  private readonly onIdle: (idleMs: number) => void;
  private source = 0;

  constructor(onIdle: (idleMs: number) => void) {
    this.onIdle = onIdle;
  }

  start(): void {
    const monitor = global.backend.get_core_idle_monitor();
    this.source = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, IDLE_POLL_S, () => {
      this.onIdle(monitor.get_idletime());
      return GLib.SOURCE_CONTINUE;
    });
  }

  stop(): void {
    if (this.source) GLib.source_remove(this.source);
    this.source = 0;
  }
}
