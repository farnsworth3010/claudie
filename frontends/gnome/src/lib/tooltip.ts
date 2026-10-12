import type { Rect } from '@claudie/core/scene/types.ts';

// A tooltip of this size centred above (x, bottom), kept inside the monitor around that point.
export function placeTooltip(width: number, height: number, x: number, bottom: number, monitor: Rect): Rect {
  const left = Math.min(Math.max(x - width / 2, monitor.x), monitor.x + monitor.width - width);
  const top = Math.min(Math.max(bottom - height, monitor.y), monitor.y + monitor.height - height);
  return { x: Math.round(left), y: Math.round(top), width, height };
}
