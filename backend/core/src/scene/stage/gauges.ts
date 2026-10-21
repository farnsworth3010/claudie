import type { LimitKind, Limits, LimitWindow } from '../../limits/types.ts';
import { CLOCK_KINDS, CLOCK_SCALE } from '../constants/clock.ts';
import { clockFrame } from '../draw/clock.ts';
import { lookPalette } from '../look.ts';
import type { Rect } from '../types.ts';
import { limitLabel } from './label.ts';
import { Sprite } from './sprite.ts';

const PALETTE = lookPalette({ hue: 0, size: 0 }); // the clocks use only the fixed colours
const GAP = 2; // art pixels between the clocks

interface Gauge {
  readonly kind: LimitKind;
  readonly window: LimitWindow;
  readonly sprite: Sprite;
}

// The usage limit clocks: they stand where they were put, apart from the crews, and never walk.
export class Gauges {
  private readonly sprites = new Map<LimitKind, Sprite>();
  private shown: Gauge[] = [];
  private px = 0;
  width = 0;
  height = 0;

  // A window shows until it starts over; the status line brings the next one.
  // `px`: the Clawds' size, which the clocks follow at their own scale.
  layout(limits: Limits | undefined, now: number, px: number): void {
    this.px = Math.max(1, Math.round(px * CLOCK_SCALE));
    this.shown = CLOCK_KINDS.flatMap((kind) => {
      const window = limits?.[kind];
      if (!window || now >= window.resetsAt) return [];
      let sprite = this.sprites.get(kind);
      if (!sprite) {
        sprite = new Sprite();
        this.sprites.set(kind, sprite);
      }
      sprite.frame = clockFrame(kind, window.used);
      return [{ kind, window, sprite }];
    });
    const frames = this.shown.map((gauge) => gauge.sprite.frame).filter((frame) => frame !== null);
    const w = frames.reduce((sum, frame) => sum + frame.w, 0) + GAP * (frames.length - 1);
    this.width = frames.length ? w * this.px : 0;
    this.height = Math.max(0, ...frames.map((frame) => frame.h * this.px));
  }

  // `x`, `y`: the top-left corner; the clocks stand on one floor.
  draw(x: number, y: number): void {
    let left = x;
    for (const { sprite } of this.shown) {
      const frame = sprite.frame;
      if (!frame) continue;
      sprite.place(left, y + this.height - frame.h * this.px, this.px, PALETTE);
      sprite.show(frame, undefined);
      left += (frame.w + GAP) * this.px;
    }
  }

  get list(): Sprite[] {
    return this.shown.map((gauge) => gauge.sprite);
  }

  hit(x: number, y: number): boolean {
    return this.shown.some((gauge) => gauge.sprite.hit(x, y));
  }

  // The clock under the point, with its tooltip and where it stands.
  hovered(x: number, y: number, now: number): { text: string; rect: Rect } | undefined {
    const gauge = this.shown.find((candidate) => candidate.sprite.hit(x, y));
    const frame = gauge?.sprite.frame;
    if (!gauge || !frame) return undefined;
    const { sprite } = gauge;
    return {
      text: limitLabel(gauge.kind, gauge.window, now),
      rect: { x: sprite.x, y: sprite.y, width: frame.w * sprite.px, height: frame.h * sprite.px },
    };
  }
}
