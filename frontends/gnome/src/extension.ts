import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Stage } from '@claudie/core/scene/stage/stage.ts';
import type { Action, StageSnapshot } from '@claudie/core/scene/types.ts';
import { postSettings } from './daemon/client.ts';
import { EventStream } from './daemon/events.ts';
import { IdleWatch } from './idle/idle.ts';
import { Overlay } from './overlay/overlay.ts';
import { Chirp } from './sound/chirp.ts';
import { loadAnchor, saveAnchor } from './store/anchor.ts';

interface Running {
  session: Soup.Session;
  cancellable: Gio.Cancellable;
  overlay: Overlay;
  events: EventStream;
  idle: IdleWatch;
}

// The GNOME client: follows the daemon's snapshots and draws the scene from backend/core over every
// window. Everything is built in enable() and torn down in disable(), as the shell requires.
export default class ClaudieExtension extends Extension {
  private running: Running | null = null;

  override enable(): void {
    const stage = new Stage(loadAnchor());
    const session = new Soup.Session();
    const cancellable = new Gio.Cancellable();
    const chirp = new Chirp();
    const act = (action: Action): void => {
      if (action.type === 'chirp') chirp.play();
      else if (action.type === 'settings') postSettings(session, action.patch, cancellable);
      else if (action.type === 'anchor') saveAnchor(action.anchor);
    };
    const overlay = new Overlay(stage, act);
    const events = new EventStream(session, (json) => {
      try {
        stage.sync(JSON.parse(json) as StageSnapshot);
      } catch (error) {
        console.warn(`Claudie: bad snapshot: ${error}`);
        return;
      }
      overlay.tick();
    });
    const idle = new IdleWatch((idleMs) => stage.idle(idleMs));
    overlay.start();
    events.start();
    idle.start();
    this.running = { session, cancellable, overlay, events, idle };
  }

  override disable(): void {
    if (!this.running) return;
    const { session, cancellable, overlay, events, idle } = this.running;
    idle.stop();
    events.stop();
    cancellable.cancel();
    session.abort();
    overlay.destroy();
    this.running = null;
  }
}
