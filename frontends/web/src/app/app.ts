import { Component, computed, inject } from '@angular/core';
import { Daemon } from './daemon/daemon.ts';
import { Gallery } from './gallery/gallery.ts';
import { Preview } from './preview/preview.ts';
import { SettingsForm } from './settings/settings-form.ts';
import { Simulator } from './simulator/simulator.ts';

// The page the daemon serves: the settings with a live preview of the sessions, a simulator of
// made-up ones, and a gallery of every animation.
@Component({
  selector: 'app-root',
  imports: [Preview, SettingsForm, Simulator, Gallery],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly daemon = inject(Daemon);
  protected readonly connected = this.daemon.connected;
  protected readonly status = computed(() => {
    const connected = this.connected();
    if (connected === null) return 'connecting…';
    return connected ? 'connected to the daemon' : 'the daemon is unreachable, retrying…';
  });
}
