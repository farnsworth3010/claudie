import type { Rect } from '@claudie/core/scene/types.ts';

// Where the Clawds may go on a monitor: its work area leaves out the top bar and any dock, and
// the settings can give either back.
export function area(monitor: Rect, work: Rect, overDock: boolean, overMenuBar: boolean): Rect {
  const left = overDock ? monitor.x : work.x;
  const right = overDock ? monitor.x + monitor.width : work.x + work.width;
  const top = overMenuBar ? monitor.y : work.y;
  const bottom = overDock ? monitor.y + monitor.height : work.y + work.height;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// The union of rects, or null for none.
export function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
