import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { HookEvent, Snapshot } from '@claudie/core/session/types.ts';
import { DEFAULT_SETTINGS } from '@claudie/core/settings/constants.ts';
import type { Settings } from '@claudie/core/settings/types.ts';

// The daemon that serves the page, so every path is relative to it. Its snapshots arrive over
// server-sent events; EventSource reconnects by itself when the daemon comes back.
@Injectable({ providedIn: 'root' })
export class Daemon {
  private readonly latest = signal<Snapshot | null>(null);
  private readonly reachable = signal<boolean | null>(null); // null until the first answer
  readonly snapshot = this.latest.asReadonly();
  readonly connected = this.reachable.asReadonly();
  readonly settings = computed<Settings>(() => this.latest()?.settings ?? DEFAULT_SETTINGS);

  constructor() {
    const source = new EventSource('/events');
    source.addEventListener('state', (e) => {
      this.latest.set(JSON.parse((e as MessageEvent<string>).data) as Snapshot);
      this.reachable.set(true);
    });
    source.onerror = () => {
      this.latest.set(null);
      this.reachable.set(false);
    };
    inject(DestroyRef).onDestroy(() => source.close());
  }

  saveSettings(patch: Partial<Settings>): void {
    this.post('/settings', patch);
  }

  // `keepalive` lets the request outlive the page, for the goodbyes sent as it closes.
  postHook(event: HookEvent, keepalive = false): void {
    this.post('/hook', event, keepalive);
  }

  private post(path: string, body: unknown, keepalive = false): void {
    // A failure needs no handling of its own: the daemon being down already shows in the status.
    fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    }).catch(() => {});
  }
}
