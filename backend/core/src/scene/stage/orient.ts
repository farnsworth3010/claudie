import type { Box, Point, Rect, Side } from '../types.ts';

// The crews are laid out upright, feet down, in a box `width`×`height`; on a wall or the ceiling
// that box is turned so their feet face the edge they crawl on. The turned box keeps its top-left
// corner, and on a wall its sides swap. `edge` is the one the feet are on.

export function turnedSize(edge: Side, width: number, height: number): { width: number; height: number } {
  return edge === 'left' || edge === 'right' ? { width: height, height: width } : { width, height };
}

// Upright to on screen. Walking forward (rightwards when upright) goes up the right wall, left
// along the ceiling and down the left wall.
export function toScreen(edge: Side, box: Box, p: Point): Point {
  const u = p.x - box.x;
  const v = p.y - box.y;
  const { width: w, height: h } = box;
  const [x, y] =
    edge === 'right' ? [v, w - u] : edge === 'top' ? [w - u, h - v] : edge === 'left' ? [h - v, u] : [u, v];
  return { x: box.x + x, y: box.y + y };
}

export function toUpright(edge: Side, box: Box, p: Point): Point {
  const x = p.x - box.x;
  const y = p.y - box.y;
  const { width: w, height: h } = box;
  const [u, v] =
    edge === 'right' ? [w - y, x] : edge === 'top' ? [w - x, h - y] : edge === 'left' ? [y, h - x] : [x, y];
  return { x: box.x + u, y: box.y + v };
}

export function turnRect(edge: Side, box: Box, r: Rect): Rect {
  const a = toScreen(edge, box, { x: r.x, y: r.y });
  const b = toScreen(edge, box, { x: r.x + r.width, y: r.y + r.height });
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

// A w×h frame's pixels turned the same way; a wall makes it h wide.
export function turnPixels(pixels: Uint8Array, w: number, h: number, edge: Side): Uint8Array {
  if (edge === 'bottom') return pixels;
  const out = new Uint8Array(pixels.length);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const color = pixels[row * w + col];
      if (edge === 'right') out[(w - 1 - col) * h + row] = color;
      else if (edge === 'left') out[col * h + (h - 1 - row)] = color;
      else out[(h - 1 - row) * w + (w - 1 - col)] = color;
    }
  }
  return out;
}
