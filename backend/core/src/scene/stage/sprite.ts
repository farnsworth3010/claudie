import { EYES, SOLID } from '../constants/grid.ts';
import { gazeAt, opaqueNear } from '../geometry.ts';
import type { Frame, Gaze, Point, Rect, Side } from '../types.ts';

export class Sprite {
  x = 0; // where it stands, before the clip's own sideways shift
  y = 0;
  tx = 0;
  px = 0;
  palette = '';
  opacity = 1;
  delivering = false; // drawn above the other minis while it walks its result over
  frame: Frame | null = null;

  place(x: number, y: number, px: number, palette: readonly string[]): void {
    this.x = x;
    this.y = y;
    this.px = px;
    this.palette = palette.join();
  }

  // `bounds`: walking in or bouncing back never carries the body past it.
  show(frame: Frame, bounds: Rect | undefined): void {
    let tx = frame.dx * this.px;
    if (bounds) {
      const [from, to] = frame.solid;
      tx = Math.max(Math.min(tx, bounds.x + bounds.width - this.x - to * this.px), bounds.x - this.x - from * this.px);
    }
    this.tx = Math.round(tx);
    this.opacity = frame.opacity;
    this.frame = frame;
  }

  gazeAt(pointer: Point | null): Gaze | undefined {
    if (!pointer || !this.px) return undefined;
    return gazeAt((pointer.x - this.x - this.tx) / this.px - EYES.x, (pointer.y - this.y) / this.px - EYES.y);
  }

  // Whether a standing body would touch the left or right edge of `bounds`, within one art pixel.
  touches(side: Side, bounds: Rect): boolean {
    const gap =
      side === 'left'
        ? this.x + SOLID[0] * this.px - bounds.x
        : bounds.x + bounds.width - (this.x + SOLID[1] * this.px);
    return gap <= this.px;
  }

  hit(x: number, y: number): boolean {
    return (
      !!this.frame && this.px > 0 && opaqueNear(this.frame, (x - this.x - this.tx) / this.px, (y - this.y) / this.px)
    );
  }
}
