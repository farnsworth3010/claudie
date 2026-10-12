import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import type { Stage } from '@claudie/core/scene/stage/stage.ts';
import type { Action, Rect, View } from '@claudie/core/scene/types.ts';
import { openSettingsPage } from '../daemon/client.ts';
import { FAST_TICK_MS, IDLE_TICKS, MARGIN, SLOW_TICK_MS } from '../lib/constants.ts';
import { union } from '../lib/screens.ts';
import { placeTooltip } from '../lib/tooltip.ts';
import { monitorAt, screens } from './screens.ts';
import { SpriteCache } from './sprites.ts';

interface Placed {
  actor: Clutter.Actor;
  key: string;
}

// The Clawds above every window, in the shell's top chrome. The container covers only the sprites
// and the tooltip, and is reactive only over a Clawd's pixels: everywhere else clicks reach the
// windows below. The shell hides the container itself over fullscreen windows, so an empty scene
// hides the layer inside it instead.
export class Overlay {
  private readonly stage: Stage;
  private readonly onAction: (action: Action) => void;
  private readonly container = new St.Widget({ reactive: false });
  private readonly layer = new Clutter.Actor({ visible: false });
  private readonly tooltip = new St.Label({ style_class: 'claudie-tooltip', visible: false });
  private readonly cache = new SpriteCache();
  private readonly placed: Placed[] = [];
  private readonly signals: Array<[{ disconnect(id: number): void }, number]> = [];
  private timer = 0;
  private fast = false;
  private dragging = false;
  private grab: Clutter.Grab | null = null;
  private clickThrough = false;
  private edges = { overDock: false, overMenuBar: false };
  private overFullscreen: boolean | null = null;
  private tooltipText = '';
  private tooltipSize = { width: 0, height: 0 };
  private drawn = ''; // the last view rendered, as JSON: most ticks at rest change nothing
  private emptyTicks = 0;

  constructor(stage: Stage, onAction: (action: Action) => void) {
    this.stage = stage;
    this.onAction = onAction;
  }

  start(): void {
    this.container.add_child(this.layer);
    this.layer.add_child(this.tooltip);
    this.chrome(false);
    this.updateScreens();
    const layout = Main.layoutManager;
    this.signals.push([layout, layout.connect('monitors-changed', () => this.updateScreens())]);
    this.signals.push([global.display, global.display.connect('workareas-changed', () => this.updateScreens())]);
    this.container.connect('button-press-event', (_actor, event: Clutter.Event) => this.pressed(event));
    this.container.connect('motion-event', (_actor, event: Clutter.Event) => this.moved(event));
    this.container.connect('button-release-event', (_actor, event: Clutter.Event) => this.released(event));
    this.container.connect('scroll-event', (_actor, event: Clutter.Event) => this.scrolled(event));
    this.schedule();
  }

  destroy(): void {
    if (this.timer) GLib.source_remove(this.timer);
    this.timer = 0;
    for (const [object, id] of this.signals) object.disconnect(id);
    this.signals.length = 0;
    this.grab?.dismiss();
    this.grab = null;
    Main.layoutManager.removeChrome(this.container);
    this.container.destroy();
  }

  // Also what a snapshot or an input event calls, which wakes a stopped timer.
  tick(): void {
    if (!this.timer) this.schedule();
    // No check of the button state here: the grab taken on press brings the release wherever it is.
    const [x, y, modifiers] = global.get_pointer();
    const view = this.stage.tick({ x, y });
    for (const action of this.stage.takeActions()) this.onAction(action);
    const json = JSON.stringify(view);
    if (json !== this.drawn) {
      this.drawn = json;
      this.render(view);
    }
    this.updateMouse(x, y, modifiers);
    const empty = view.sprites.length === 0 && !view.fast && !this.dragging;
    this.emptyTicks = empty ? this.emptyTicks + 1 : 0;
    if (this.emptyTicks >= IDLE_TICKS) this.stop();
    else this.setFast(view.fast || this.dragging);
  }

  private schedule(): void {
    if (this.timer) GLib.source_remove(this.timer);
    this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.fast ? FAST_TICK_MS : SLOW_TICK_MS, () => {
      this.tick();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private stop(): void {
    if (this.timer) GLib.source_remove(this.timer);
    this.timer = 0;
    this.emptyTicks = 0;
  }

  private setFast(fast: boolean): void {
    if (fast === this.fast) return;
    this.fast = fast;
    this.schedule();
  }

  // Fullscreen tracking is fixed when the actor joins the chrome, so a change re-adds it.
  private chrome(overFullscreen: boolean): void {
    if (this.overFullscreen === overFullscreen) return;
    if (this.overFullscreen !== null) Main.layoutManager.removeChrome(this.container);
    Main.layoutManager.addTopChrome(this.container, { trackFullscreen: !overFullscreen });
    this.overFullscreen = overFullscreen;
  }

  private updateScreens(): void {
    this.stage.setScreens(screens(this.edges.overDock, this.edges.overMenuBar));
    this.drawn = ''; // the same view may now fall elsewhere
  }

  private render(view: View): void {
    this.chrome(view.overFullscreen);
    this.clickThrough = view.clickThrough;
    if (view.overDock !== this.edges.overDock || view.overMenuBar !== this.edges.overMenuBar) {
      this.edges = { overDock: view.overDock, overMenuBar: view.overMenuBar };
      this.updateScreens();
    }
    if (view.sprites.length === 0) {
      this.layer.hide();
      return;
    }
    for (const sprite of view.sprites) this.cache.remember(sprite);
    const rects: Rect[] = view.sprites.map((s) => ({ x: s.x, y: s.y, width: s.w * s.px, height: s.h * s.px }));
    const tip = this.tooltipRect(view);
    const bounds = union(tip ? [...rects, tip] : rects);
    if (!bounds) return;
    const left = Math.floor(bounds.x) - MARGIN;
    const top = Math.floor(bounds.y) - MARGIN;
    this.container.set_position(left, top);
    this.container.set_size(Math.ceil(bounds.width) + 2 * MARGIN + 1, Math.ceil(bounds.height) + 2 * MARGIN + 1);
    this.container.opacity = Math.round(view.opacity * 255);

    while (this.placed.length < view.sprites.length) {
      const actor = new Clutter.Actor();
      actor.set_content_scaling_filters(Clutter.ScalingFilter.NEAREST, Clutter.ScalingFilter.NEAREST);
      this.layer.insert_child_below(actor, this.tooltip);
      this.placed.push({ actor, key: '' });
    }
    this.placed.forEach((slot, index) => {
      const sprite = view.sprites[index];
      const image = sprite && this.cache.image(sprite);
      if (!sprite || !image) {
        slot.actor.hide();
        return;
      }
      const key = this.cache.key(sprite);
      if (slot.key !== key) {
        slot.actor.set_content(image);
        slot.key = key;
      }
      const rect = rects[index];
      slot.actor.set_position(rect.x - left, rect.y - top);
      slot.actor.set_size(rect.width, rect.height);
      slot.actor.opacity = Math.round(sprite.opacity * 255);
      slot.actor.show();
    });
    if (tip) {
      this.tooltip.set_position(tip.x - left, tip.y - top);
      this.tooltip.show();
    } else {
      this.tooltip.hide();
    }
    this.layer.set_size(this.container.width, this.container.height);
    this.layer.show();
  }

  // Measured only when the text changes; the label must be on the stage for its style to count.
  private tooltipRect(view: View): Rect | null {
    const tip = view.tooltip;
    if (!tip) return null;
    if (tip.text !== this.tooltipText) {
      this.tooltipText = tip.text;
      this.tooltip.text = tip.text;
      const [, width] = this.tooltip.get_preferred_width(-1);
      const [, height] = this.tooltip.get_preferred_height(width);
      this.tooltipSize = { width: Math.ceil(width), height: Math.ceil(height) };
    }
    const monitor = monitorAt(tip.x, tip.y);
    if (!monitor) return null;
    return placeTooltip(this.tooltipSize.width, this.tooltipSize.height, tip.x, tip.y, monitor);
  }

  // Click-through lets the mouse past the Clawds unless Alt is held; a drag keeps it to the end.
  private updateMouse(x: number, y: number, modifiers: Clutter.ModifierType): void {
    const reachable = !this.clickThrough || (modifiers & Clutter.ModifierType.MOD1_MASK) !== 0;
    const take = this.dragging || (reachable && this.stage.hit(x, y));
    if (this.container.reactive !== take) this.container.reactive = take;
  }

  private pressed(event: Clutter.Event): boolean {
    const [x, y] = event.get_coords();
    const button = event.get_button();
    if (button === Clutter.BUTTON_PRIMARY) {
      this.dragging = this.stage.press(x, y);
      if (this.dragging) this.grab = global.stage.grab(this.container);
      this.tick();
      return Clutter.EVENT_STOP;
    }
    // The container takes the mouse only over a Clawd, but a right click may land as it moves away.
    if (button === Clutter.BUTTON_SECONDARY && this.stage.hit(x, y)) {
      openSettingsPage();
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  }

  private moved(event: Clutter.Event): boolean {
    if (!this.dragging) return Clutter.EVENT_PROPAGATE;
    const [x, y] = event.get_coords();
    this.stage.motion(x, y);
    this.setFast(true);
    return Clutter.EVENT_STOP;
  }

  private released(event: Clutter.Event): boolean {
    if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this.dragging) return Clutter.EVENT_PROPAGATE;
    this.endDrag();
    this.tick();
    return Clutter.EVENT_STOP;
  }

  private endDrag(): void {
    this.dragging = false;
    this.grab?.dismiss();
    this.grab = null;
    this.stage.release();
  }

  // Ctrl+scroll resizes: a wheel notch is one step, a touchpad's smooth deltas add up to steps.
  private scrolled(event: Clutter.Event): boolean {
    if (!(event.get_state() & Clutter.ModifierType.CONTROL_MASK)) return Clutter.EVENT_PROPAGATE;
    if (event.is_pointer_emulated()) return Clutter.EVENT_STOP; // the smooth event it copies counts
    const direction = event.get_scroll_direction();
    let delta = 0;
    if (direction === Clutter.ScrollDirection.UP) delta = 1;
    else if (direction === Clutter.ScrollDirection.DOWN) delta = -1;
    else if (direction === Clutter.ScrollDirection.SMOOTH) delta = -event.get_scroll_delta()[1];
    if (delta !== 0) {
      this.stage.zoom(delta);
      this.tick();
    }
    return Clutter.EVENT_STOP;
  }
}
