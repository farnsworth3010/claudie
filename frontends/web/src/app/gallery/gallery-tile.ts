import { Component, DestroyRef, type ElementRef, inject, input, viewChild } from '@angular/core';
import { GRID_H, GRID_W } from '@claudie/core/scene/constants/grid.ts';
import { AnimationFrames } from '../shared/animation-frames.ts';
import { fitCanvas, paintPixels } from '../shared/paint.ts';
import type { TileSpec } from './types.ts';

// One animation on its own canvas, played from when the page opened.
@Component({
  selector: 'app-gallery-tile',
  templateUrl: './gallery-tile.html',
  styleUrl: './gallery-tile.css',
})
export class GalleryTile {
  readonly spec = input.required<TileSpec>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private shown: Uint8Array | undefined; // the pixels on the canvas, to skip painting the same frame again

  constructor() {
    const frames = inject(AnimationFrames);
    frames.add((now) => this.paint(now - frames.start), inject(DestroyRef));
  }

  private paint(elapsed: number): void {
    const { frameAt, palette, px } = this.spec();
    const frame = frameAt(elapsed);
    if (frame.pixels === this.shown) return;
    this.shown = frame.pixels;
    const canvas = this.canvas().nativeElement;
    const ctx = fitCanvas(canvas, GRID_W * px, GRID_H * px);
    ctx.clearRect(0, 0, GRID_W * px, GRID_H * px);
    paintPixels(ctx, frame.pixels, frame.w, palette, 0, 0, px);
    canvas.style.transform = `translateX(${frame.dx * px}px)`;
    canvas.style.opacity = String(frame.opacity);
  }
}
