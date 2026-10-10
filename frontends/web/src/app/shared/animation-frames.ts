import { type DestroyRef, Injectable } from '@angular/core';

export type FrameCallback = (now: number) => void;

// One requestAnimationFrame loop for every canvas on the page; it runs only while someone draws.
@Injectable({ providedIn: 'root' })
export class AnimationFrames {
  readonly start = performance.now(); // when the page's animations began
  private readonly callbacks = new Set<FrameCallback>();
  private handle = 0;

  // `draw` runs on every frame until `owner` is destroyed.
  add(draw: FrameCallback, owner: DestroyRef): void {
    this.callbacks.add(draw);
    owner.onDestroy(() => {
      this.callbacks.delete(draw);
      if (!this.callbacks.size) cancelAnimationFrame(this.handle);
    });
    if (this.callbacks.size === 1) this.handle = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    for (const draw of this.callbacks) draw(now);
    if (this.callbacks.size) this.handle = requestAnimationFrame(this.tick);
  };
}
