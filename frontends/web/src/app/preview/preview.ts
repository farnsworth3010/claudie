import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { chirpWav } from '@claudie/core/scene/sound/chirp.ts';
import { Stage } from '@claudie/core/scene/stage/stage.ts';
import type { Action, Point, SpriteDraw, View } from '@claudie/core/scene/types.ts';
import type { Session } from '@claudie/core/session/types.ts';
import { Daemon } from '../daemon/daemon.ts';
import { AnimationFrames } from '../shared/animation-frames.ts';
import { fitCanvas, paintPixels } from '../shared/paint.ts';
import { SAMPLE_PROJECT, WHEEL_NOTCH } from './constants.ts';

interface Tooltip {
  readonly text: string;
  readonly x: number; // centre
  readonly y: number; // bottom edge
}

const sameTooltip = (a: Tooltip | null, b: Tooltip | null): boolean =>
  a === b || (!!a && !!b && a.text === b.text && a.x === b.x && a.y === b.y);

// The overlay in a box: the same stage the Mac app runs, with the canvas for a screen. It drags,
// pokes, chirps and zooms like the real one; a zoom changes the size setting, as on the Mac.
@Component({
  selector: 'app-preview',
  templateUrl: './preview.html',
  styleUrl: './preview.css',
})
export class Preview {
  private readonly daemon = inject(Daemon);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly stage = new Stage();
  private readonly pixels = new Map<number, readonly number[]>(); // by frame id, as they arrive
  private readonly sampleSince = Date.now();
  private size = { width: 0, height: 0 };
  private pointer: Point | null = null;
  private chirp: HTMLAudioElement | undefined;
  protected readonly tooltip = signal<Tooltip | null>(null, { equal: sameTooltip });
  protected readonly grab = signal(false);

  constructor() {
    // With no session running, or no daemon, an idle Clawd stands in so the settings show on something.
    effect(() => {
      const snapshot = this.daemon.snapshot();
      const now = snapshot?.now ?? Date.now();
      const sessions = snapshot?.sessions.length ? [...snapshot.sessions] : [this.sample(now)];
      this.stage.sync({ now, sessions, settings: this.daemon.settings() });
    });
    inject(AnimationFrames).add(() => this.frame(), inject(DestroyRef));
  }

  protected moved(e: PointerEvent): void {
    this.pointer = { x: e.offsetX, y: e.offsetY };
    this.stage.motion(e.offsetX, e.offsetY);
  }

  protected left(): void {
    this.pointer = null;
  }

  protected pressed(e: PointerEvent): void {
    if (this.stage.press(e.offsetX, e.offsetY)) this.canvas().nativeElement.setPointerCapture(e.pointerId);
  }

  protected released(): void {
    this.stage.release();
  }

  // Ctrl+wheel (and a pinch, which browsers send as one) resizes instead of zooming the page.
  protected wheeled(e: WheelEvent): void {
    if (!e.ctrlKey) return;
    e.preventDefault();
    this.stage.zoom(-e.deltaY / WHEEL_NOTCH);
  }

  private frame(): void {
    this.resize();
    const view = this.stage.tick(this.pointer);
    this.paint(view);
    this.tooltip.set(view.tooltip ?? null);
    this.grab.set(!!this.pointer && this.stage.hit(this.pointer.x, this.pointer.y));
    this.placeTooltip();
    for (const action of this.stage.takeActions()) this.act(action);
  }

  private sample(now: number): Session {
    return {
      id: 'sample',
      cwd: `/${SAMPLE_PROJECT}`,
      project: SAMPLE_PROJECT,
      activity: 'idle',
      mood: 'none',
      agents: [],
      startedAt: this.sampleSince,
      since: this.sampleSince,
      seenAt: now,
    };
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.host.nativeElement;
    if (width === this.size.width && height === this.size.height) return;
    this.size = { width, height };
    this.stage.setScreens([{ id: 1, area: { x: 0, y: 0, width, height } }]);
  }

  private paint(view: View): void {
    const ctx = fitCanvas(this.canvas().nativeElement, this.size.width, this.size.height);
    ctx.clearRect(0, 0, this.size.width, this.size.height);
    for (const sprite of view.sprites) this.paintSprite(ctx, sprite, view.opacity);
  }

  // A frame's pixels come only the first time its id is drawn.
  private paintSprite(ctx: CanvasRenderingContext2D, sprite: SpriteDraw, opacity: number): void {
    if (sprite.pixels) this.pixels.set(sprite.id, sprite.pixels);
    const pixels = this.pixels.get(sprite.id);
    if (!pixels) return;
    ctx.globalAlpha = opacity * sprite.opacity;
    paintPixels(ctx, pixels, sprite.w, sprite.palette.split(','), sprite.x, sprite.y, sprite.px);
    ctx.globalAlpha = 1;
  }

  // Kept inside the box; its size is known only once it is on the page.
  private placeTooltip(): void {
    const tip = this.tooltip();
    const el = this.tooltipEl()?.nativeElement;
    if (!tip || !el) return;
    const left = Math.min(Math.max(tip.x - el.offsetWidth / 2, 0), this.size.width - el.offsetWidth);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(tip.y - el.offsetHeight, 0)}px`;
  }

  private act(action: Action): void {
    if (action.type === 'settings') this.daemon.saveSettings(action.patch);
    else if (action.type === 'chirp') void this.chirpSound().play();
    // 'anchor': where the group was dropped matters only inside the box, which keeps it anyway.
  }

  private chirpSound(): HTMLAudioElement {
    if (!this.chirp) {
      const wav = new Blob([new Uint8Array(chirpWav())], { type: 'audio/wav' });
      this.chirp = new Audio(URL.createObjectURL(wav));
    }
    this.chirp.currentTime = 0;
    return this.chirp;
  }
}
