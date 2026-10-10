// Pixel art on a 2D canvas: each art pixel a `px`-sized square of its palette colour.

// Sizes the canvas to `width`×`height` CSS pixels at the screen's density; returns its context.
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Palette entries that aren't colours ('transparent') draw nothing.
export function paintPixels(
  ctx: CanvasRenderingContext2D,
  pixels: ArrayLike<number>,
  w: number,
  palette: readonly string[],
  x: number,
  y: number,
  px: number,
): void {
  for (let i = 0; i < pixels.length; i++) {
    const color = palette[pixels[i]];
    if (!color || color === 'transparent') continue;
    ctx.fillStyle = color;
    ctx.fillRect(x + (i % w) * px, y + Math.floor(i / w) * px, px, px);
  }
}
