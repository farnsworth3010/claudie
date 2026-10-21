import { type SignLayout, signFrame, signLayout } from '../draw/sign.ts';
import { lookPalette } from '../look.ts';
import type { Point, SignButton } from '../types.ts';
import { Sprite } from './sprite.ts';

const PALETTE = lookPalette({ hue: 0, size: 0 }); // the sign uses only the fixed colours

interface Shown {
  readonly layout: SignLayout;
  readonly workMin: number;
  readonly snoozeMin: number;
}

// The break sign one Clawd holds up: a board with two buttons, always drawn upright.
export class Sign {
  private readonly sprite = new Sprite();
  private shown: Shown | null = null;
  private px = 0;

  get width(): number {
    return this.shown ? this.shown.layout.w * this.px : 0;
  }

  get height(): number {
    return this.shown ? this.shown.layout.h * this.px : 0;
  }

  // `px`: points per art pixel.
  layout(workMin: number, snoozeMin: number, px: number): void {
    this.shown = { layout: signLayout(workMin, snoozeMin), workMin, snoozeMin };
    this.px = px;
  }

  hide(): void {
    this.shown = null;
    this.sprite.frame = null;
  }

  // `x`, `y`: the top-left corner; the button under the pointer lights up.
  draw(x: number, y: number, pointer: Point | null): void {
    if (!this.shown) return;
    this.sprite.place(x, y, this.px, PALETTE);
    const hovered = pointer ? (this.buttonAt(pointer.x, pointer.y) ?? null) : null;
    this.sprite.show(signFrame(this.shown.workMin, this.shown.snoozeMin, hovered), undefined);
  }

  get list(): Sprite[] {
    return this.shown && this.sprite.frame ? [this.sprite] : [];
  }

  // The whole board takes the mouse, so a click between the buttons never falls through.
  hit(x: number, y: number): boolean {
    const { sprite } = this;
    return (
      !!this.shown &&
      !!sprite.frame &&
      x >= sprite.x &&
      y >= sprite.y &&
      x < sprite.x + this.width &&
      y < sprite.y + this.height
    );
  }

  buttonAt(x: number, y: number): SignButton | undefined {
    if (!this.shown || !this.px) return undefined;
    const ax = (x - this.sprite.x) / this.px;
    const ay = (y - this.sprite.y) / this.px;
    const { buttons } = this.shown.layout;
    return (['skip', 'done'] as const).find((name) => {
      const b = buttons[name];
      return ax >= b.x && ay >= b.y && ax < b.x + b.w && ay < b.y + b.h;
    });
  }
}
